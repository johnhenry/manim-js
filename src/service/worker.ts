// The render-service worker: a pull loop against the coordinator —
// claim (long-poll) → render → upload → complete, with heartbeats renewing
// the lease throughout. Workers need the SAME deployed project on disk as
// the coordinator (same machine or a shared/baked volume); the scene path
// safety checks are re-run here since the worker is the process that
// actually imports the module.
//
// Rendering: jobs with `params` use node.ts render() (schema-validated
// params); others use renderParallel() when parallelism.mode==="workers",
// else render(). The render implementation is injectable so the HTTP
// round-trip tests don't need ffmpeg.

import { createReadStream, mkdtempSync, rmSync, existsSync, realpathSync, statSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import type { JobRecord, JobProgress } from "./protocol.ts";
import { artifactExtension } from "./protocol.ts";

export interface RenderContext {
  /** Absolute, verified scene module path. */
  scenePath: string;
  /** Where the artifact must be written. */
  outputPath: string;
  onProgress(progress: JobProgress): void;
}

export type RenderImpl = (job: JobRecord, ctx: RenderContext) => Promise<void>;

export interface WorkerOptions {
  coordinatorUrl: string;
  projectDir: string;
  workerToken?: string;
  workerId?: string;
  /** Long-poll wait seconds per claim request (default 25). */
  pollWaitSec?: number;
  /** Heartbeat interval ms (default 15s — well under the 60s lease). */
  heartbeatMs?: number;
  /** Process one job (or one empty poll) then return — for tests/cron. */
  once?: boolean;
  renderImpl?: RenderImpl;
  verbose?: boolean;
}

const defaultRenderImpl: RenderImpl = async (job, ctx) => {
  const spec = job.spec;
  const renderOpts: Record<string, any> = { ...(spec.render ?? {}), output: ctx.outputPath, verbose: false };
  const workers = spec.parallelism?.workers ?? spec.render?.workers;
  delete renderOpts.workers;
  if (spec.parallelism?.mode === "workers" && !spec.params) {
    // TODO(S4): renderParallel gains `params` support; until then params jobs
    // take the sequential path below.
    const { renderParallel } = await import("../node-parallel.ts");
    await renderParallel(ctx.scenePath, spec.exportName ?? "default", {
      ...renderOpts,
      outPath: ctx.outputPath,
      ...(workers ? { workers } : {}),
    });
    return;
  }
  const { render } = await import("../node.ts");
  const { pathToFileURL } = await import("node:url");
  const mod = await import(pathToFileURL(ctx.scenePath).href);
  const exportName = spec.exportName ?? "default";
  const target = mod[exportName] ?? (exportName === "default" ? mod.default : undefined);
  if (target == null) throw new Error(`scene export "${exportName}" not found in ${spec.scene}`);
  await render(target, { ...renderOpts, ...(spec.params ? { params: spec.params } : {}) });
};

export class ServiceWorker {
  readonly workerId: string;
  private opts: WorkerOptions;
  private projectDir: string;
  private stopped = false;

  constructor(options: WorkerOptions) {
    this.opts = options;
    this.workerId = options.workerId ?? `${hostname()}-${randomUUID().slice(0, 8)}`;
    this.projectDir = realpathSync(resolve(options.projectDir));
  }

  private async api(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<Response> {
    const headers: Record<string, string> = { ...(init.headers as any) };
    const token = this.opts.workerToken ?? process.env.ECMANIM_WORKER_TOKEN;
    if (token) headers.authorization = `Bearer ${token}`;
    const sep2 = path.includes("?") ? "&" : "?";
    const url = `${this.opts.coordinatorUrl}${path}${sep2}workerId=${encodeURIComponent(this.workerId)}`;
    return fetch(url, { ...init, headers });
  }

  /** Verify the job's scene path inside OUR copy of the project. */
  private scenePath(job: JobRecord): string {
    const abs = resolve(this.projectDir, job.spec.scene);
    if (abs !== this.projectDir && !abs.startsWith(this.projectDir + sep)) {
      throw new Error("scene resolves outside the project directory");
    }
    if (!existsSync(abs)) throw new Error(`scene file not found: ${job.spec.scene}`);
    const real = realpathSync(abs);
    if (real !== this.projectDir && !real.startsWith(this.projectDir + sep)) {
      throw new Error("scene resolves outside the project directory (symlink)");
    }
    if (!statSync(real).isFile()) throw new Error("scene is not a file");
    return real;
  }

  private async processJob(job: JobRecord): Promise<void> {
    const verbose = this.opts.verbose ?? false;
    const heartbeatMs = this.opts.heartbeatMs ?? 15_000;
    let lastProgress: JobProgress | null = null;
    const beat = setInterval(() => {
      this.api(`/api/v1/worker/jobs/${job.id}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lastProgress ? { progress: lastProgress } : {}),
      }).catch(() => {});
    }, heartbeatMs);
    beat.unref?.();

    const workDir = mkdtempSync(join(tmpdir(), "ecmanim-job-"));
    try {
      const scenePath = this.scenePath(job);
      const outputPath = join(workDir, `out.${artifactExtension(job.spec)}`);
      if (verbose) console.log(`[worker ${this.workerId}] rendering job ${job.id}: ${job.spec.scene}`);
      const renderImpl = this.opts.renderImpl ?? defaultRenderImpl;
      await renderImpl(job, {
        scenePath,
        outputPath,
        onProgress: (progress) => {
          lastProgress = progress;
          this.api(`/api/v1/worker/jobs/${job.id}/progress`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ progress }),
          }).catch(() => {});
        },
      });
      if (!existsSync(outputPath)) throw new Error("render produced no output file");

      // Upload, then complete.
      const filename = `out.${artifactExtension(job.spec)}`;
      const upload = await this.api(`/api/v1/worker/jobs/${job.id}/artifact?filename=${encodeURIComponent(filename)}`, {
        method: "PUT",
        body: createReadStream(outputPath) as any,
        duplex: "half",
      } as any);
      if (upload.status !== 200) throw new Error(`artifact upload failed: HTTP ${upload.status}`);
      const { artifactKey } = await upload.json() as any;
      const complete = await this.api(`/api/v1/worker/jobs/${job.id}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ artifactKey }),
      });
      if (complete.status !== 200) throw new Error(`complete failed: HTTP ${complete.status}`);
      if (verbose) console.log(`[worker ${this.workerId}] job ${job.id} done`);
    } catch (e: any) {
      if (verbose) console.error(`[worker ${this.workerId}] job ${job.id} failed: ${e?.message}`);
      await this.api(`/api/v1/worker/jobs/${job.id}/fail`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: e?.stack ?? String(e) }),
      }).catch(() => {});
    } finally {
      clearInterval(beat);
      rmSync(workDir, { recursive: true, force: true });
    }
  }

  /** Run the claim loop until stop() (or one cycle with `once`). */
  async run(): Promise<void> {
    const waitSec = this.opts.pollWaitSec ?? 25;
    while (!this.stopped) {
      let res: Response;
      try {
        res = await this.api(`/api/v1/worker/claim?wait=${waitSec}`, { method: "POST" });
      } catch (e: any) {
        if (this.opts.verbose) console.error(`[worker ${this.workerId}] claim error: ${e?.message}`);
        if (this.opts.once) return;
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (res.status === 200) {
        const { job } = await res.json() as any;
        await this.processJob(job);
      } else if (res.status === 401) {
        throw new Error("worker unauthorized (check ECMANIM_WORKER_TOKEN)");
      }
      if (this.opts.once) return;
    }
  }

  stop(): void {
    this.stopped = true;
  }
}

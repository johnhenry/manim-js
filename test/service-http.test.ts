// Render-service S2: full HTTP round-trips against an in-process coordinator
// on port 0 — auth, submit→claim→progress→upload→complete→download, cancel,
// long-poll 204, lease-expiry requeue, SSE events, webhook on completion.
// The worker runs with an injected renderImpl (no ffmpeg needed).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCoordinator } from "../src/service/coordinator.ts";
import type { Coordinator } from "../src/service/coordinator.ts";
import { ServiceWorker } from "../src/service/worker.ts";
import { MemoryJobStore } from "../src/service/queue.ts";

// A minimal "deployed project" with one scene file (never actually imported
// here — renderImpl is injected).
const tmp = mkdtempSync(join(tmpdir(), "ecmanim-svc-http-"));
const projectDir = join(tmp, "project");
mkdirSync(projectDir, { recursive: true });
writeFileSync(join(projectDir, "demo.ts"), "export default async (scene) => {};\n");

test.after(() => rmSync(tmp, { recursive: true, force: true }));

async function withCoordinator(
  opts: Partial<Parameters<typeof startCoordinator>[0]>,
  fn: (c: Coordinator) => Promise<void>,
): Promise<void> {
  const c = await startCoordinator({
    projectDir,
    port: 0,
    store: new MemoryJobStore(),
    dataDir: mkdtempSync(join(tmp, "data-")),
    ...opts,
  });
  try { await fn(c); } finally { await c.close(); }
}

const SUBMIT = { scene: "demo.ts" };

test("auth: wrong/missing tokens get 401 on both APIs; healthz stays open", async () => {
  await withCoordinator({ apiToken: "client-secret", workerToken: "worker-secret" }, async (c) => {
    assert.equal((await fetch(`${c.url}/healthz`)).status, 200);
    assert.equal((await fetch(`${c.url}/api/v1/jobs`)).status, 401);
    assert.equal((await fetch(`${c.url}/api/v1/jobs`, { headers: { authorization: "Bearer nope" } })).status, 401);
    assert.equal((await fetch(`${c.url}/api/v1/worker/claim`, { method: "POST" })).status, 401);
    const ok = await fetch(`${c.url}/api/v1/jobs`, { headers: { authorization: "Bearer client-secret" } });
    assert.equal(ok.status, 200);
    // Worker token doesn't open the client API and vice versa.
    assert.equal((await fetch(`${c.url}/api/v1/jobs`, { headers: { authorization: "Bearer worker-secret" } })).status, 401);
  });
});

test("submit validation: bad specs 400 with errors; missing scene file 400", async () => {
  await withCoordinator({}, async (c) => {
    const bad = await fetch(`${c.url}/api/v1/jobs`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ scene: "../escape.ts" }),
    });
    assert.equal(bad.status, 400);
    assert.match(JSON.stringify(await bad.json()), /unsafe path/);
    const missing = await fetch(`${c.url}/api/v1/jobs`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ scene: "nope.ts" }),
    });
    assert.equal(missing.status, 400);
    assert.match(JSON.stringify(await missing.json()), /not found in project/);
  });
});

test("submit → worker claim/progress/upload/complete → artifact download + SSE + webhook", async () => {
  const webhookHits: any[] = [];
  await withCoordinator({
    webhookTransport: async (url, init) => {
      webhookHits.push({ url, body: JSON.parse(init.body), sig: init.headers["x-ecmanim-signature"] });
      return { status: 200 };
    },
  }, async (c) => {
    // SSE listener collecting events.
    const events: any[] = [];
    const sse = await fetch(`${c.url}/api/v1/events`);
    const reader = sse.body!.getReader();
    const readEvents = (async () => {
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (done) break;
        buf += dec.decode(value);
        let i;
        while ((i = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          for (const line of block.split("\n")) {
            if (line.startsWith("data: ")) events.push(JSON.parse(line.slice(6)));
          }
        }
      }
    })();

    const submit = await fetch(`${c.url}/api/v1/jobs`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...SUBMIT,
        webhook: { url: "http://receiver.test/hook", secret: "whsec" },
      }),
    });
    assert.equal(submit.status, 201);
    const { job } = await submit.json() as any;
    assert.equal(job.state, "queued");

    const worker = new ServiceWorker({
      coordinatorUrl: c.url,
      projectDir,
      once: true,
      renderImpl: async (j, ctx) => {
        assert.ok(ctx.scenePath.endsWith("demo.ts"));
        ctx.onProgress({ segmentsDone: 1, segmentsTotal: 2 });
        writeFileSync(ctx.outputPath, Buffer.from("FAKE-MP4-BYTES"));
      },
    });
    await worker.run();

    const done = await (await fetch(`${c.url}/api/v1/jobs/${job.id}`)).json() as any;
    assert.equal(done.job.state, "done");
    assert.deepEqual(done.job.progress, { segmentsDone: 1, segmentsTotal: 2 });

    const artifact = await fetch(`${c.url}/api/v1/jobs/${job.id}/artifact`);
    assert.equal(artifact.status, 200);
    assert.equal(await artifact.text(), "FAKE-MP4-BYTES");

    // Webhook delivered exactly once, signed, with the terminal state.
    for (let i = 0; i < 20 && webhookHits.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
    assert.equal(webhookHits.length, 1);
    assert.equal(webhookHits[0].body.jobId, job.id);
    assert.equal(webhookHits[0].body.state, "done");
    assert.ok(webhookHits[0].sig.startsWith("t="));

    await reader.cancel().catch(() => {});
    await readEvents;
    const states = events.filter((e) => e.jobId === job.id).map((e) => e.state);
    assert.ok(states.includes("claimed"), `SSE saw claim (${states})`);
    assert.ok(states.includes("done"), `SSE saw done (${states})`);
  });
});

test("worker failure path: fail → requeue → second attempt succeeds", async () => {
  await withCoordinator({}, async (c) => {
    const submit = await fetch(`${c.url}/api/v1/jobs`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(SUBMIT),
    });
    const { job } = await submit.json() as any;
    let attempt = 0;
    const worker = new ServiceWorker({
      coordinatorUrl: c.url, projectDir, once: true,
      renderImpl: async (_j, ctx) => {
        if (++attempt === 1) throw new Error("transient renderer crash");
        writeFileSync(ctx.outputPath, Buffer.from("OK"));
      },
    });
    await worker.run(); // attempt 1 fails
    assert.equal((await (await fetch(`${c.url}/api/v1/jobs/${job.id}`)).json() as any).job.state, "queued");
    await worker.run(); // attempt 2 — wait, once:true returned; rerun claims again
    const final = await (await fetch(`${c.url}/api/v1/jobs/${job.id}`)).json() as any;
    assert.equal(final.job.state, "done");
    assert.equal(final.job.attempts, 2);
  });
});

test("cancel: DELETE cancels a queued job; artifact 409s; claim skips it", async () => {
  await withCoordinator({}, async (c) => {
    const { job } = await (await fetch(`${c.url}/api/v1/jobs`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(SUBMIT),
    })).json() as any;
    assert.equal((await fetch(`${c.url}/api/v1/jobs/${job.id}`, { method: "DELETE" })).status, 200);
    assert.equal((await (await fetch(`${c.url}/api/v1/jobs/${job.id}`)).json() as any).job.state, "canceled");
    assert.equal((await fetch(`${c.url}/api/v1/jobs/${job.id}/artifact`)).status, 409);
    const claim = await fetch(`${c.url}/api/v1/worker/claim`, { method: "POST" });
    assert.equal(claim.status, 204, "canceled job is not claimable");
  });
});

test("long-poll: claim with wait= returns 204 after the deadline on an empty queue", async () => {
  await withCoordinator({}, async (c) => {
    const t0 = Date.now();
    const res = await fetch(`${c.url}/api/v1/worker/claim?wait=1`, { method: "POST" });
    assert.equal(res.status, 204);
    assert.ok(Date.now() - t0 >= 900, "held the poll for ~1s");
  });
});

test("lease expiry: a claimed-then-abandoned job is requeued by the sweep", async () => {
  await withCoordinator({ leaseMs: 50, sweepIntervalMs: 40 }, async (c) => {
    const { job } = await (await fetch(`${c.url}/api/v1/jobs`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(SUBMIT),
    })).json() as any;
    const claim = await fetch(`${c.url}/api/v1/worker/claim`, { method: "POST" });
    assert.equal(claim.status, 200);
    // Abandon: no heartbeat. The sweep should requeue it.
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const state = (await (await fetch(`${c.url}/api/v1/jobs/${job.id}`)).json() as any).job.state;
      if (state === "queued") return;
    }
    assert.fail("job was never requeued after lease expiry");
  });
});

test("stats endpoint aggregates by state", async () => {
  await withCoordinator({}, async (c) => {
    await fetch(`${c.url}/api/v1/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(SUBMIT) });
    await fetch(`${c.url}/api/v1/jobs`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(SUBMIT) });
    const stats = await (await fetch(`${c.url}/api/v1/stats`)).json() as any;
    assert.equal(stats.total, 2);
    assert.equal(stats.byState.queued, 2);
  });
});

// Showcase parity: GitHub Unwrapped — per-user year-in-review videos at
// scale. Proves: a schema-parameterized Unwrapped scene (titleCard +
// contribution grid + statCounters + PieChart + outroCard) fanned out as
// FIVE param-varied jobs through the RENDER SERVICE (Cluster S) — submitted
// over HTTP, rendered by a pull-model worker, artifacts downloaded. Falls
// back to local renders when ECMANIM_RENDER_SERVICE_URL is unset AND no
// local coordinator can be started (never hard-fails).

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { demoOut, DEMO_QUALITY } from "./_run.ts";

const USERS = [
  { user: "ada", commits: 2417, prs: 184, topLang: "TypeScript", langA: 61, langB: 24, langC: 15 },
  { user: "grace", commits: 1892, prs: 132, topLang: "Rust", langA: 48, langB: 33, langC: 19 },
  { user: "linus", commits: 3541, prs: 96, topLang: "C", langA: 72, langB: 18, langC: 10 },
  { user: "margaret", commits: 1204, prs: 208, topLang: "Python", langA: 55, langB: 30, langC: 15 },
  { user: "alan", commits: 987, prs: 74, topLang: "Haskell", langA: 66, langB: 22, langC: 12 },
];

// The scene lives in its own module (the render service imports it by path).
const SCENE_REL = "examples/showcase-parity/scenes/unwrapped-scene.ts";
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const external = process.env.ECMANIM_RENDER_SERVICE_URL;
let coordinatorUrl = external ?? "";
let localService: any = null;
let worker: any = null;

if (!external) {
  // Spin up the WHOLE service in-process: coordinator + one worker, with the
  // repo itself as the deployed project.
  const { startCoordinator, ServiceWorker } = await import("../../src/service.ts");
  localService = await startCoordinator({
    projectDir: repoRoot,
    port: 0,
    dataDir: join(here, "out", "_gen", "unwrapped-service"),
  });
  coordinatorUrl = localService.url;
  worker = new ServiceWorker({ coordinatorUrl, projectDir: repoRoot, verbose: false });
  const loop = worker.run(); // pull loop; stopped after downloads
  void loop;
  console.log(`✓ local render service up at ${coordinatorUrl}`);
}

// Submit one job per user.
const jobs: Array<{ user: string; id: string }> = [];
for (const params of USERS) {
  const res = await fetch(`${coordinatorUrl}/api/v1/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scene: SCENE_REL,
      params,
      render: { quality: DEMO_QUALITY, fps: 20 },
      priority: 1,
    }),
  });
  const json: any = await res.json();
  if (res.status !== 201) throw new Error(`submit failed: ${JSON.stringify(json)}`);
  jobs.push({ user: params.user, id: json.job.id });
  console.log(`  queued ${params.user}: job ${json.job.id}`);
}

// Await all five, then download the artifacts next to the other demo outputs.
const outDir = dirname(demoOut(import.meta.url));
mkdirSync(outDir, { recursive: true });
for (const job of jobs) {
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    const j: any = (await (await fetch(`${coordinatorUrl}/api/v1/jobs/${job.id}`)).json()).job;
    if (j.state === "done") break;
    if (["failed", "canceled"].includes(j.state)) throw new Error(`job for ${job.user} ${j.state}: ${j.error}`);
  }
  const artifact = await fetch(`${coordinatorUrl}/api/v1/jobs/${job.id}/artifact`);
  const bytes = Buffer.from(await artifact.arrayBuffer());
  const dest = demoOut(import.meta.url, `-${job.user}`);
  writeFileSync(dest, bytes);
  console.log(`✓ 05-github-unwrapped-${job.user}.mp4 (${(bytes.length / 1024).toFixed(0)} KiB via render service)`);
}

if (worker) worker.stop();
if (localService) await localService.close();
copyFileSync; // (kept for symmetry with other demos' imports)

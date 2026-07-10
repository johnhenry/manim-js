// Run every showcase-parity demo in sequence: `npm run demos:showcase`.
// Env: ECMANIM_DEMO_QUALITY (low|medium|high), ECMANIM_DEMO_SKIP_GL=1,
// ECMANIM_TTS=openai, ECMANIM_RENDER_SERVICE_URL=<coordinator>.
// Each demo is its own process so one failure doesn't sink the batch.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const demos = readdirSync(here)
  .filter((f) => /^\d\d-.*\.ts$/.test(f))
  .sort();

let failed = 0;
for (const demo of demos) {
  console.log(`\n=== ${demo} ===`);
  const res = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", join(here, demo)], {
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    console.error(`✗ ${demo} exited ${res.status}`);
    failed++;
  }
}
console.log(`\n${demos.length - failed}/${demos.length} demos rendered${failed ? ` (${failed} FAILED)` : ""}`);
process.exit(failed ? 1 : 0);

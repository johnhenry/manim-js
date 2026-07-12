// Extracts a JPEG thumbnail from each demo's ALREADY-RENDERED mp4 (via
// ffmpeg/ffprobe) into a sibling thumbs/ dir next to that campaign's out/.
// Never renders anything itself -- demos with no video yet are skipped and
// reported, not rendered on the spot (see gallery/README.md's "lazy full
// render" note). Idempotent: re-run any time after new demos are rendered.

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { buildManifest } from "./manifest.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = dirname(HERE);

function probeDuration(mp4Path: string): number {
  const out = execFileSync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    mp4Path,
  ], { encoding: "utf8" });
  const d = parseFloat(out.trim());
  return Number.isFinite(d) ? d : 0;
}

function extractThumb(mp4Path: string, jpgPath: string): void {
  const duration = probeDuration(mp4Path);
  const seekTo = duration > 2 ? duration * 0.4 : Math.min(0.5, duration / 2);
  mkdirSync(dirname(jpgPath), { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-v", "error",
    "-ss", String(seekTo),
    "-i", mp4Path,
    "-frames:v", "1",
    "-vf", "scale=480:-1",
    "-q:v", "4",
    jpgPath,
  ]);
}

const manifest = buildManifest();
let made = 0, skippedNoVideo = 0, alreadyDone = 0, failed = 0;

for (const cat of manifest.categories) {
  for (const demo of cat.demos) {
    if (!demo.video) { skippedNoVideo++; continue; }
    if (demo.thumb) { alreadyDone++; continue; }
    const mp4Path = join(EXAMPLES_DIR, demo.video);
    const jpgPath = mp4Path.replace(/\/out\//, "/thumbs/").replace(/\.mp4$/, ".jpg");
    if (existsSync(jpgPath)) { alreadyDone++; continue; }
    try {
      extractThumb(mp4Path, jpgPath);
      made++;
      process.stdout.write(`.`);
    } catch (err) {
      failed++;
      console.error(`\n✗ ${demo.id}: ${(err as Error).message.split("\n")[0]}`);
    }
  }
}

console.log(
  `\nthumbs: ${made} extracted, ${alreadyDone} already present, ${skippedNoVideo} skipped (no video yet), ${failed} failed`,
);
if (skippedNoVideo > 0) {
  console.log(`Run the missing demos' full renders (npx tsx <file>) to pick up thumbnails for them, then re-run this script.`);
}

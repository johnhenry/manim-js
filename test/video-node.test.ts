// Tests for the Node VideoMobject backend: ffprobe/ffmpeg probing + frame
// extraction, the in-memory FrameCacheProvider, the loadVideo() factory, audio
// scheduling, and a guarded end-to-end render. The whole file is skipped when
// ffmpeg/ffprobe are unavailable (synthesizes its own clips via lavfi).

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { probeVideo, extractFrames } from "../src/renderer/ffmpeg.ts";
import { FrameCacheProvider, loadVideo } from "../src/video-node.ts";
import { VideoMobject } from "../src/mobject/video_mobject.ts";
import { Scene } from "../src/scene/Scene.ts";

// --- ffmpeg/ffprobe availability guard -------------------------------------
function hasBin(bin: string): boolean {
  try {
    const r = spawnSync(bin, ["-version"], { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}
const FFMPEG = hasBin("ffmpeg") && hasBin("ffprobe");
const skip = FFMPEG ? false : "ffmpeg/ffprobe not available";

// --- shared temp workspace + synthesized clips ------------------------------
let work: string;
let silentClip: string; // 128x72, 10fps, 1s, no audio
let audioClip: string;  // same + a 440Hz sine

function synth(args: string[]): void {
  const r = spawnSync("ffmpeg", ["-y", ...args], { stdio: "ignore" });
  if (r.status !== 0) throw new Error("ffmpeg synth failed: " + args.join(" "));
}

before(() => {
  if (!FFMPEG) return;
  work = mkdtempSync(join(tmpdir(), "manim-video-test-"));
  silentClip = join(work, "silent.mp4");
  audioClip = join(work, "audio.mp4");
  // testsrc: a moving pattern, so consecutive frames genuinely differ.
  synth([
    "-f", "lavfi", "-i", "testsrc=duration=1:size=128x72:rate=10",
    "-pix_fmt", "yuv420p", silentClip,
  ]);
  synth([
    "-f", "lavfi", "-i", "testsrc=duration=1:size=128x72:rate=10",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
    "-pix_fmt", "yuv420p", "-shortest", audioClip,
  ]);
});

after(() => {
  if (work && existsSync(work)) rmSync(work, { recursive: true, force: true });
});

// --- probeVideo -------------------------------------------------------------
test("probeVideo reports duration/dimensions/fps and no audio", { skip }, async () => {
  const p = await probeVideo(silentClip);
  assert.ok(Math.abs(p.duration - 1) < 0.3, `duration ~1, got ${p.duration}`);
  assert.equal(p.width, 128);
  assert.equal(p.height, 72);
  assert.ok(Math.abs(p.fps - 10) < 1, `fps ~10, got ${p.fps}`);
  assert.equal(p.hasAudio, false);
});

test("probeVideo detects an audio stream", { skip }, async () => {
  const p = await probeVideo(audioClip);
  assert.equal(p.hasAudio, true);
  assert.ok(Math.abs(p.fps - 10) < 1);
});

test("probeVideo parses fractional avg_frame_rate (30000/1001)", { skip }, async () => {
  const ntsc = join(work, "ntsc.mp4");
  synth([
    "-f", "lavfi", "-i", "testsrc=duration=1:size=64x64:rate=30000/1001",
    "-pix_fmt", "yuv420p", ntsc,
  ]);
  const p = await probeVideo(ntsc);
  // 30000/1001 ≈ 29.97
  assert.ok(Math.abs(p.fps - 29.97) < 0.5, `fps ~29.97, got ${p.fps}`);
});

// --- extractFrames ----------------------------------------------------------
test("extractFrames writes ~10 numbered PNGs", { skip }, async () => {
  const dir = join(work, "frames-basic");
  const files = await extractFrames(silentClip, { fps: 10, dir });
  assert.ok(files.length >= 9 && files.length <= 11, `~10 frames, got ${files.length}`);
  for (const f of files) {
    assert.ok(f.endsWith(".png"));
    assert.ok(statSync(f).size > 0, "frame nonzero");
  }
  // Sorted order is stable.
  const sorted = [...files].sort();
  assert.deepEqual(files, sorted);
});

test("extractFrames honors scale", { skip }, async () => {
  const dir = join(work, "frames-scaled");
  const files = await extractFrames(silentClip, { fps: 5, scale: [64, 36], dir });
  assert.ok(files.length >= 4, `got ${files.length}`);
});

// --- FrameCacheProvider -----------------------------------------------------
test("FrameCacheProvider.frameAt returns distinct drawables", { skip }, async () => {
  const dir = join(work, "frames-provider");
  const files = await extractFrames(silentClip, { fps: 10, dir });
  const provider = new FrameCacheProvider({ files, fps: 10, width: 128, height: 72 });
  await provider.init();
  assert.equal(provider.frameCount, files.length);

  const f0 = provider.frameAt(0);
  const fMid = provider.frameAt(0.5);
  assert.ok(f0, "frame 0 non-null");
  assert.ok(fMid, "frame 0.5 non-null");
  assert.notEqual(f0, fMid, "different times -> different Image objects");

  // Clamping: negative and beyond-duration times resolve to end frames.
  assert.ok(provider.frameAt(-5), "clamps below 0");
  assert.ok(provider.frameAt(999), "clamps above duration");

  provider.dispose();
  assert.equal(provider.frameCount, 0);
});

// --- loadVideo factory ------------------------------------------------------
test("loadVideo returns a VideoMobject whose advance() changes the frame", { skip }, async () => {
  const vm = await loadVideo(silentClip, { fps: 10 });
  assert.ok(vm instanceof VideoMobject);
  assert.equal(vm.provider.width, 128);
  assert.equal(vm.provider.height, 72);

  const first = vm.image;
  vm.advance(0.5);
  const later = vm.image;
  assert.ok(first && later, "images present");
  assert.notEqual(first, later, "advancing changes the shown frame");
  vm.dispose();
});

test("loadVideo respects start/end and loop in sourceTime()", { skip }, async () => {
  const vm = await loadVideo(silentClip, { fps: 10, start: 0.2, end: 0.6, loop: true });
  // At elapsed 0, sourceTime == start.
  assert.ok(Math.abs(vm.sourceTime() - 0.2) < 1e-6);
  // Advancing within span stays within [start, end).
  vm.advance(0.3); // elapsed 0.3, span 0.4 -> source 0.2 + 0.3 = 0.5
  assert.ok(Math.abs(vm.sourceTime() - 0.5) < 1e-6, `got ${vm.sourceTime()}`);
  // Looping wraps around the 0.4s span.
  vm.seekTo(0.5); // 0.5 % 0.4 = 0.1 -> source 0.3
  assert.ok(Math.abs(vm.sourceTime() - 0.3) < 1e-6, `looped, got ${vm.sourceTime()}`);
  vm.dispose();
});

test("loadVideo reuses the frame cache on a second call", { skip }, async () => {
  const cacheDir = join(work, "shared-cache");
  const vm1 = await loadVideo(silentClip, { fps: 8, cacheDir });
  // After the first call the keyed subdir holds frames.
  const subdirs = readdirSync(cacheDir);
  assert.ok(subdirs.length >= 1, "cache subdir created");
  const framesBefore = readdirSync(join(cacheDir, subdirs[0])).length;
  // Second call must hit the cache (same key) and still work.
  const vm2 = await loadVideo(silentClip, { fps: 8, cacheDir });
  assert.ok(vm2 instanceof VideoMobject);
  const framesAfter = readdirSync(join(cacheDir, subdirs[0])).length;
  assert.equal(framesAfter, framesBefore, "no re-extraction");
  vm1.dispose();
  vm2.dispose();
});

// --- audio scheduling -------------------------------------------------------
test("loadVideo with audio pushes one sound onto the scene", { skip }, async () => {
  const scene = new Scene({ fps: 10, frameHandler: async () => {} });
  (scene as any).time = 0.25;
  const vm = await loadVideo(audioClip, {
    fps: 10,
    scene,
    audio: true,
    cacheDir: join(work, "audio-cache"),
  });
  assert.ok(vm instanceof VideoMobject);
  assert.equal(scene.sounds.length, 1, "one sound scheduled");
  const s = scene.sounds[0];
  assert.ok(Math.abs(s.time - 0.25) < 1e-6, `timeOffset from scene.time, got ${s.time}`);
  assert.equal(s.gain, 1);
  assert.ok(existsSync(s.file), "audio file exists on disk");
  vm.dispose();
});

test("loadVideo audio honors explicit audioOffset and gain", { skip }, async () => {
  const scene = new Scene({ fps: 10, frameHandler: async () => {} });
  const vm = await loadVideo(audioClip, {
    fps: 10,
    scene,
    audio: true,
    audioOffset: 1.5,
    gain: 0.5,
    cacheDir: join(work, "audio-cache2"),
  });
  const s = scene.sounds[0];
  assert.ok(Math.abs(s.time - 1.5) < 1e-6);
  assert.equal(s.gain, 0.5);
  vm.dispose();
});

test("loadVideo with audio:true but no audio stream schedules nothing", { skip }, async () => {
  const scene = new Scene({ fps: 10, frameHandler: async () => {} });
  await loadVideo(silentClip, {
    fps: 10,
    scene,
    audio: true,
    cacheDir: join(work, "noaudio-cache"),
  });
  assert.equal(scene.sounds.length, 0);
});

// --- guarded end-to-end render ----------------------------------------------
test("e2e: render a Scene containing a VideoMobject to mp4", { skip }, async () => {
  const { render } = await import("../src/node.ts");
  const out = join(work, "e2e.mp4");
  const vm = await loadVideo(silentClip, { fps: 10, cacheDir: join(work, "e2e-cache") });

  await render(
    async (scene: any) => {
      scene.add(vm);
      await scene.wait(0.5);
    },
    { output: out, fps: 10, pixelWidth: 128, pixelHeight: 72, verbose: false },
  );

  assert.ok(existsSync(out), "output mp4 exists");
  assert.ok(statSync(out).size > 0, "output nonzero");
  vm.dispose();
});

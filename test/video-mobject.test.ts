// Core VideoMobject logic (backend-agnostic): the per-frame updater, source-time
// mapping (start/end/playbackRate/loop), seek, and pause — exercised with a
// synthetic in-memory provider so no ffmpeg or browser is involved.

import { test } from "node:test";
import assert from "node:assert/strict";
import { VideoMobject } from "../src/mobject/video_mobject.ts";
import type { VideoFrameProvider } from "../src/mobject/video_mobject.ts";

// A fake provider whose frames are the strings "f0".."f{n-1}" at a given fps.
// frameAt(t) returns the frame for round(t*fps), clamped — mirroring how the
// real providers index, and lets us assert exactly which frame is shown.
function fakeProvider(nFrames: number, fps: number): VideoFrameProvider & { disposed: boolean } {
  const frames = Array.from({ length: nFrames }, (_, i) => `f${i}`);
  return {
    duration: nFrames / fps,
    width: 128,
    height: 72,
    fps,
    disposed: false,
    frameAt(t: number) {
      const i = Math.max(0, Math.min(nFrames - 1, Math.round(t * fps)));
      return frames[i];
    },
    dispose() { (this as any).disposed = true; },
  };
}

test("VideoMobject seeds the first frame and intrinsic aspect from the provider", () => {
  const p = fakeProvider(11, 10); // duration 1.1s, 128x72
  const v = new VideoMobject(p, { start: 0 });
  assert.equal(v._isImage, true);
  assert.equal((v as any)._isVideo, true);
  assert.equal(v.image, "f0");
  assert.ok(Math.abs(v.aspect - 128 / 72) < 1e-9);
});

test("advance(dt) walks frames by scene time (deterministic)", () => {
  const p = fakeProvider(11, 10);
  const v = new VideoMobject(p, {});
  v.advance(0.30); // -> t=0.30 -> round(3)=frame 3
  assert.equal(v.image, "f3");
  v.advance(0.25); // -> t=0.55 -> round(5.5)=frame 6 (round half up)
  assert.equal(v.image, "f6");
});

test("playbackRate scales the source time", () => {
  const p = fakeProvider(21, 10); // 2.1s
  const v = new VideoMobject(p, { playbackRate: 2 });
  v.advance(0.5); // elapsed 0.5*2 = 1.0s -> frame 10
  assert.equal(v.image, "f10");
});

test("without loop, playback clamps at the out-point (holds last frame)", () => {
  const p = fakeProvider(11, 10); // 1.1s span
  const v = new VideoMobject(p, {});
  v.advance(5); // way past the end
  assert.equal(v.sourceTime(), 1.1);
  assert.equal(v.image, "f10"); // clamped to the last available frame
});

test("loop wraps the [start,end) span", () => {
  const p = fakeProvider(11, 10); // 1.1s
  const v = new VideoMobject(p, { loop: true });
  v.advance(1.1 + 0.3); // one full span + 0.3 -> wraps to t=0.3 -> frame 3
  assert.ok(Math.abs(v.sourceTime() - 0.3) < 1e-9);
  assert.equal(v.image, "f3");
});

test("start/end select a sub-span; sourceTime is offset by start", () => {
  const p = fakeProvider(21, 10); // 2.1s
  const v = new VideoMobject(p, { start: 0.5, end: 1.5 });
  assert.equal(v.image, "f5"); // seeded at start=0.5 -> frame 5
  v.advance(0.4); // elapsed 0.4 into the span -> source 0.9 -> frame 9
  assert.ok(Math.abs(v.sourceTime() - 0.9) < 1e-9);
  assert.equal(v.image, "f9");
  v.advance(5); // clamp at end=1.5
  assert.equal(v.sourceTime(), 1.5);
});

test("paused suppresses auto-advance; play() resumes", () => {
  const p = fakeProvider(11, 10);
  const v = new VideoMobject(p, { paused: true });
  // Simulate the scene updater loop.
  v.update(0.3); // runs updaters with dt; paused -> no change
  assert.equal(v.image, "f0");
  v.play();
  v.update(0.3);
  assert.equal(v.image, "f3");
  v.pause();
  v.update(0.3);
  assert.equal(v.image, "f3"); // frozen again
});

test("seekTo jumps to a playback time and shows that frame", () => {
  const p = fakeProvider(11, 10);
  const v = new VideoMobject(p, {});
  v.seekTo(0.7);
  assert.equal(v.image, "f7");
  assert.equal(v._elapsed, 0.7);
});

test("playDuration accounts for span and rate", () => {
  const p = fakeProvider(21, 10); // 2.1s
  assert.ok(Math.abs(new VideoMobject(p, {}).playDuration - 2.1) < 1e-9);
  assert.ok(Math.abs(new VideoMobject(p, { playbackRate: 2 }).playDuration - 1.05) < 1e-9);
  assert.ok(Math.abs(new VideoMobject(p, { start: 0.5, end: 1.5 }).playDuration - 1.0) < 1e-9);
});

test("the updater drives frames through Mobject.update (as the scene does)", () => {
  const p = fakeProvider(11, 10);
  const v = new VideoMobject(p, {});
  v.update(0.2); // scene calls m.update(dt); the built-in updater advances
  assert.equal(v.image, "f2");
});

test("dispose delegates to the provider", () => {
  const p = fakeProvider(11, 10);
  const v = new VideoMobject(p, {});
  v.dispose();
  assert.equal(p.disposed, true);
});

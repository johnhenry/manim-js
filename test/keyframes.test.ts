import { test } from "node:test";
import assert from "node:assert/strict";

import { PlayableKeyframeTrack, bindTrack } from "../src/reactive/keyframes.ts";
import { Color } from "../src/core/color.ts";
import { Circle } from "../src/mobject/geometry.ts";
import { Scene } from "../src/scene/Scene.ts";

test("tick()/seek() agree exactly for the same absolute time", () => {
  const track = new PlayableKeyframeTrack([
    { t: 0, value: 0 },
    { t: 2, value: 20 },
  ]);

  // Authoring playback: many small tick(dt) calls accumulating to t=1.5.
  const ticked = new PlayableKeyframeTrack([
    { t: 0, value: 0 },
    { t: 2, value: 20 },
  ]);
  for (let i = 0; i < 15; i++) ticked.tick(0.1);

  // A Studio scrub: one seek(t) jump to the same absolute time.
  const seeked = track.seek(1.5);
  assert.ok(Math.abs(ticked.time - 1.5) < 1e-9);
  assert.ok(Math.abs(seeked - ticked.valueAt(ticked.time)) < 1e-9);
  assert.equal(seeked, 15); // linear ramp: 1.5/2 * 20
});

test("bindTrack() wires a track into a real Mobject.update(dt) call", () => {
  const track = new PlayableKeyframeTrack<[number, number, number]>([
    { t: 0, value: [0, 0, 0] },
    { t: 1, value: [4, 0, 0] },
  ]);
  const c = new Circle();
  bindTrack(c, "_trackedPoint" as any, track);

  (c as any).update(0.5);
  assert.deepEqual((c as any)._trackedPoint, track.valueAt(0.5));

  (c as any).update(0.5);
  assert.deepEqual((c as any)._trackedPoint, track.valueAt(1));
});

test("bindTrack() rides on Scene.updateMobjects(dt), with zero Scene/render changes needed", async () => {
  const scene = new Scene({ fps: 10 });
  scene.frameHandler = async () => {};
  const c = new Circle();
  scene.add(c);
  const track = scene.track<[number, number, number]>([
    { t: 0, value: [0, 0, 0] },
    { t: 1, value: [10, 0, 0] },
  ]);
  bindTrack(c, "_trackedPoint" as any, track);

  await scene.wait(1); // updateMobjects(dt) runs every frame during wait()
  assert.ok(Math.abs((c as any)._trackedPoint[0] - 10) < 1e-6);
});

test("Color.lerp-based interpolation works for a color-typed track", () => {
  const track = new PlayableKeyframeTrack([
    { t: 0, value: new Color(1, 0, 0) },
    { t: 1, value: new Color(0, 0, 1) },
  ], { interpolate: (a, b, t) => Color.lerp(a, b, t) });

  const mid = track.seek(0.5);
  assert.ok(Math.abs(mid.r - 0.5) < 1e-6);
  assert.ok(Math.abs(mid.b - 0.5) < 1e-6);
});

test("scene.track() mirrors addSound()'s ergonomic and appends to scene.keyframeTracks", () => {
  const scene = new Scene();
  assert.deepEqual(scene.keyframeTracks, []);
  const t = scene.track([{ t: 0, value: 0 }, { t: 1, value: 1 }]);
  assert.equal(scene.keyframeTracks.length, 1);
  assert.equal(scene.keyframeTracks[0], t);
});

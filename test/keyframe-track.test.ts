import { test } from "node:test";
import assert from "node:assert/strict";

import { KeyframeTrack, PlayKeyframeTrack, animateSignal } from "../src/animation/keyframe_track.ts";
import { Color } from "../src/core/color.ts";
import { Circle } from "../src/mobject/geometry.ts";
import { easeInOutSine } from "../src/animation/rate_functions.ts";
// Side-effect import: registerBuiltins() seeds the registry with rate
// functions/factories, needed for the string-ease resolution test below.
import "../src/index.ts";

test("linear interpolation with no ease", () => {
  const track = new KeyframeTrack([
    { t: 0, value: 0 },
    { t: 1, value: 10 },
  ]);
  assert.equal(track.valueAt(0), 0);
  assert.equal(track.valueAt(1), 10);
  assert.equal(track.valueAt(0.5), 5);
});

test("clamping outside the keyframe range", () => {
  const track = new KeyframeTrack([
    { t: 1, value: 5 },
    { t: 2, value: 15 },
  ]);
  assert.equal(track.valueAt(-10), 5);
  assert.equal(track.valueAt(100), 15);
});

test("string-ease resolution via running()", () => {
  const linearTrack = new KeyframeTrack([
    { t: 0, value: 0 },
    { t: 1, value: 10, ease: "easeInOutSine" },
  ]);
  const direct = new KeyframeTrack([
    { t: 0, value: 0 },
    { t: 1, value: 10, ease: easeInOutSine },
  ]);
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assert.ok(Math.abs(linearTrack.valueAt(t) - direct.valueAt(t)) < 1e-9, `mismatch at t=${t}`);
  }
  // Sanity: the eased value actually differs from a plain linear ramp somewhere.
  assert.notEqual(linearTrack.valueAt(0.25), 2.5);
});

test("number[] (Vec3) interpolation via V.lerp", () => {
  const track = new KeyframeTrack<[number, number, number]>([
    { t: 0, value: [0, 0, 0] },
    { t: 1, value: [10, 20, 0] },
  ]);
  const v = track.valueAt(0.5) as any;
  assert.ok(Math.abs(v[0] - 5) < 1e-9);
  assert.ok(Math.abs(v[1] - 10) < 1e-9);
});

test("a value type with no default interpolation throws, naming options.interpolate", () => {
  const track = new KeyframeTrack([
    { t: 0, value: { r: 0 } as any },
    { t: 1, value: { r: 1 } as any },
  ]);
  assert.throws(() => track.valueAt(0.5), /options\.interpolate/);
});

test("a Color-typed track works via options.interpolate = Color.lerp", () => {
  const track = new KeyframeTrack([
    { t: 0, value: new Color(1, 0, 0) },
    { t: 1, value: new Color(0, 0, 1) },
  ], { interpolate: (a, b, t) => Color.lerp(a, b, t) });
  const mid = track.valueAt(0.5);
  assert.ok(Math.abs(mid.r - 0.5) < 1e-6);
  assert.ok(Math.abs(mid.b - 0.5) < 1e-6);
});

test("addKeyframe/removeKeyframe maintain sort order and affect future valueAt results", () => {
  const track = new KeyframeTrack([
    { t: 0, value: 0 },
    { t: 2, value: 20 },
  ]);
  assert.equal(track.valueAt(1), 10);

  // Insert out of order -- keyframes must stay sorted.
  track.addKeyframe({ t: 1, value: 100 });
  assert.deepEqual(track.keyframes.map((k) => k.t), [0, 1, 2]);
  assert.equal(track.valueAt(1), 100);
  assert.equal(track.duration, 2);

  // Remove the middle (now index 1) keyframe -- reverts to the direct ramp.
  track.removeKeyframe(1);
  assert.deepEqual(track.keyframes.map((k) => k.t), [0, 2]);
  assert.equal(track.valueAt(1), 10);
});

test("PlayKeyframeTrack integration: drives a real Circle's position through begin()/interpolate()/finish()", () => {
  const track = new KeyframeTrack<[number, number, number]>([
    { t: 0, value: [0, 0, 0] },
    { t: 1, value: [4, 0, 0] },
  ]);
  const c = new Circle();
  const anim = new PlayKeyframeTrack(c, track, (mob, v) => mob.moveTo(v));
  assert.equal(anim.runTime, track.duration);

  anim.begin();
  assert.ok(Math.abs(c.getCenter()[0] - 0) < 1e-9);
  anim.interpolate(0.5);
  assert.ok(Math.abs(c.getCenter()[0] - 2) < 1e-9);
  anim.finish();
  assert.ok(Math.abs(c.getCenter()[0] - 4) < 1e-9);
});

test("explicit config.runTime overrides the track's own duration", () => {
  const track = new KeyframeTrack([{ t: 0, value: 0 }, { t: 5, value: 10 }]);
  const c = new Circle();
  const anim = new PlayKeyframeTrack(c, track, () => {}, { runTime: 2 });
  assert.equal(anim.runTime, 2);
});

test("animateSignal() drives a signal's setter via a keyframe track, with no mobject", () => {
  const track = new KeyframeTrack([{ t: 0, value: 0 }, { t: 1, value: 42 }]);
  const values: number[] = [];
  const signal = { set: (v: number) => values.push(v) };
  const anim = animateSignal(signal, track);
  anim.begin();
  anim.interpolate(0.5);
  anim.finish();
  assert.deepEqual(values, [0, 21, 42]);
});

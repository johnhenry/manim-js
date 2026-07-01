// Tests for the newly-added movement / indication / specialized / changing
// animations and the ComplexValueTracker.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Circle, Line, Square } from "../src/mobject/geometry.ts";
import { Homotopy, PhaseFlow } from "../src/animation/movement.ts";
import { ShowPassingFlash, ApplyWave } from "../src/animation/indication_extra.ts";
import { Broadcast } from "../src/animation/specialized.ts";
import { TracedPath } from "../src/animation/changing.ts";
import { ComplexValueTracker } from "../src/mobject/complex_value_tracker.ts";
import * as V from "../src/core/math/vector.ts";

test("Homotopy applies fn at t=1 (translate homotopy moves points)", () => {
  const sq = new Square({ sideLength: 2 });
  const before = sq.getCenter();
  // A homotopy that translates by +2 in x at full time.
  const anim = new Homotopy((x, y, z, t) => [x + 2 * t, y, z], sq, { rateFunc: (t: number) => t });
  anim.begin();
  anim.interpolate(1);
  const after = sq.getCenter();
  assert.ok(Math.abs(after[0] - (before[0] + 2)) < 1e-6, `expected x shift by 2, got ${after[0] - before[0]}`);
});

test("PhaseFlow moves points along a constant field", () => {
  const dot = new Circle({ radius: 0.1 });
  const before = dot.getCenter();
  // Constant velocity field pointing +x.
  const anim = new PhaseFlow(() => [1, 0, 0], dot, { virtualTime: 1, rateFunc: (t: number) => t });
  anim.begin();
  anim.interpolate(0);
  anim.interpolate(1);
  const after = dot.getCenter();
  assert.ok(after[0] > before[0] + 0.5, `expected x to advance, got ${after[0] - before[0]}`);
});

test("ShowPassingFlash slides a stroke window and is a remover", () => {
  const line = new Line([-2, 0, 0], [2, 0, 0]);
  const anim = new ShowPassingFlash(line, { timeWidth: 0.2, rateFunc: (t: number) => t });
  assert.equal(anim.remover, true, "ShowPassingFlash should be a remover");
  anim.begin();
  anim.interpolate(0.5);
  const s = line.strokeStart;
  const e = line.strokeEnd;
  assert.ok(e > s, `mid-animation stroke window should have end>start, got ${s}..${e}`);
  assert.ok(s > 0 && e < 1, `window should be interior mid-animation, got ${s}..${e}`);
});

test("ApplyWave displaces then restores to original at alpha 1", () => {
  const line = new Line([-2, 0, 0], [2, 0, 0]);
  const orig = line.points.map((p) => [...p]);
  const anim = new ApplyWave(line, { amplitude: 0.5, rateFunc: (t: number) => t });
  anim.begin();
  anim.interpolate(0.5);
  const mid = line.points.map((p) => [...p]);
  // Some point should be displaced at the midpoint.
  let maxDisp = 0;
  for (let i = 0; i < orig.length; i++) maxDisp = Math.max(maxDisp, Math.abs(mid[i][1] - orig[i][1]));
  assert.ok(maxDisp > 1e-3, `expected displacement mid-wave, got ${maxDisp}`);
  anim.finish();
  // Restored at the end.
  let maxErr = 0;
  for (let i = 0; i < orig.length; i++) maxErr = Math.max(maxErr, V.distance(line.points[i], orig[i]));
  assert.ok(maxErr < 1e-6, `expected restoration at alpha 1, got err ${maxErr}`);
});

test("Broadcast creates nMobjects copies and is a remover", () => {
  const c = new Circle({ radius: 0.5 });
  const anim = new Broadcast(c, { nMobjects: 4 });
  assert.equal(anim.remover, true, "Broadcast should be a remover");
  assert.equal(anim.getMobjectsToIntroduce().length, 4, "should introduce 4 concentric copies");
  assert.equal(anim.getMobjectsToRemove().length, 4, "should remove 4 concentric copies");
});

test("ComplexValueTracker stores and reads a complex value", () => {
  const t = new ComplexValueTracker({ re: 0, im: 0 });
  t.setValue({ re: 1, im: 2 });
  const z = t.getValue();
  assert.equal(z.re, 1, "real part");
  assert.equal(z.im, 2, "imaginary part");
  // Accepts a tuple too.
  t.setValue([3, 4]);
  assert.equal(t.getValue().re, 3);
  assert.equal(t.getValue().im, 4);
});

test("TracedPath appends points via update", () => {
  let x = 0;
  const path = new TracedPath(() => [x, 0, 0], { strokeWidth: 2 });
  const before = path.points.length;
  x = 1; path.update(0.1);
  x = 2; path.update(0.1);
  x = 3; path.update(0.1);
  assert.ok(path.points.length > before, `expected points to be appended, got ${path.points.length}`);
});

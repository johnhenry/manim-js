import { test } from "node:test";
import assert from "node:assert/strict";
import { Circle, Square } from "../src/mobject/geometry.ts";
import { Dot } from "../src/mobject/geometry.ts";
import {
  TransformFromCopy,
  ClockwiseTransform,
  MoveToTarget,
  Restore,
  ApplyMatrix,
  FadeTransform,
  CyclicReplace,
} from "../src/animation/transform_extra.ts";
import { TransformMatchingShapes } from "../src/animation/transform_matching.ts";
import { AnimationGroup } from "../src/animation/composition.ts";
import * as V from "../src/core/math/vector.ts";

test("MoveToTarget moves a mobject to its generated+moved target", () => {
  const c = new Circle({ radius: 1 });
  c.generateTarget();
  c.target.moveTo([3, 2, 0]);
  const anim = new MoveToTarget(c);
  anim.begin();
  anim.interpolate(1);
  assert.ok(V.equals(c.getCenter(), [3, 2, 0], 0.05));
});

test("MoveToTarget throws with no generated target", () => {
  const c = new Circle({ radius: 1 });
  assert.throws(() => new MoveToTarget(c), /target/i);
});

test("Restore returns a mobject to a saved state", () => {
  const c = new Circle({ radius: 1 });
  c.moveTo([0, 0, 0]);
  c.saveState();
  c.moveTo([5, 0, 0]);
  const anim = new Restore(c);
  anim.begin();
  anim.interpolate(1);
  assert.ok(V.equals(c.getCenter(), [0, 0, 0], 0.05));
});

test("ApplyMatrix rotates a point 90 degrees", () => {
  // A rotation-by-90 matrix maps the rightmost point toward +y.
  const sq = new Square({ sideLength: 2 }).moveTo([0, 0, 0]);
  const before = sq.getBoundingBox();
  const anim = new ApplyMatrix(
    [
      [0, -1],
      [1, 0],
    ],
    sq,
    { aboutPoint: [0, 0, 0] },
  );
  anim.begin();
  anim.interpolate(1);
  // The square is symmetric, but its point set is rotated: check a corner moved.
  const after = sq.getBoundingBox();
  assert.ok(Math.abs(after.max[1] - before.max[0]) < 0.1 || after.max[1] > 0.5);
  // Also verify a raw point rotated: [1,0]->[0,1] under this matrix.
  const p = V.matrixVectorProduct(
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
    [1, 0, 0],
  );
  assert.ok(V.equals(p, [0, 1, 0], 1e-9));
});

test("TransformFromCopy introduces a copy and leaves the original", () => {
  const c = new Circle({ radius: 1 }).moveTo([0, 0, 0]);
  const target = new Square({ sideLength: 2 }).moveTo([4, 0, 0]);
  const anim = new TransformFromCopy(c, target);
  assert.ok(anim.introducer, "TransformFromCopy is an introducer");
  // The animated mobject is a copy, not the original.
  assert.notStrictEqual(anim.mobject, c);
  anim.begin();
  anim.interpolate(1);
  // Original stays put.
  assert.ok(V.equals(c.getCenter(), [0, 0, 0], 0.05));
  // The copy has moved to the target.
  assert.ok(V.equals(anim.mobject.getCenter(), [4, 0, 0], 0.05));
});

test("ClockwiseTransform has a negative pathArc", () => {
  const c = new Circle({ radius: 1 });
  const target = new Square({ sideLength: 2 });
  const anim = new ClockwiseTransform(c, target);
  assert.ok(anim.pathArc < 0);
});

test("FadeTransform ends with target visible and source faded", () => {
  const src = new Circle({ radius: 1, fillColor: "#fff", fillOpacity: 1 }).moveTo([0, 0, 0]);
  const tgt = new Square({ sideLength: 2, fillColor: "#f00", fillOpacity: 1 }).moveTo([2, 0, 0]);
  const anim = new FadeTransform(src, tgt);
  anim.begin();
  // Target starts invisible.
  assert.ok((tgt.fillOpacity ?? 0) <= 0.01);
  anim.finish();
  assert.ok((tgt.fillOpacity ?? 0) > 0.9, "target visible at end");
  assert.ok((src.fillOpacity ?? 1) < 0.1, "source faded at end");
});

test("CyclicReplace of 3 mobjects cycles positions", () => {
  const a = new Dot().moveTo([0, 0, 0]);
  const b = new Dot().moveTo([2, 0, 0]);
  const d = new Dot().moveTo([4, 0, 0]);
  const anim = new CyclicReplace(a, b, d);
  assert.ok(anim instanceof AnimationGroup);
  anim.begin();
  anim.interpolate(1);
  anim.finish();
  // a -> b's spot, b -> d's spot, d -> a's spot.
  assert.ok(V.equals(a.getCenter(), [2, 0, 0], 0.1), "a moved to b");
  assert.ok(V.equals(b.getCenter(), [4, 0, 0], 0.1), "b moved to d");
  assert.ok(V.equals(d.getCenter(), [0, 0, 0], 0.1), "d moved to a");
});

test("TransformMatchingShapes builds an AnimationGroup with sub-animations", () => {
  const src = new Square({ sideLength: 2 });
  const tgt = new Circle({ radius: 1 });
  const anim = new TransformMatchingShapes(src, tgt);
  assert.ok(anim instanceof AnimationGroup);
  assert.ok(anim.animations.length > 0, "has sub-animations");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { Circle, Square } from "../src/mobject/geometry.ts";
import { flipGetState, flipFrom } from "../src/animation/flip.ts";
import * as V from "../src/core/math/vector.ts";

test("flipGetState captures center/width/height/points matching the mobject's own getters", () => {
  const c = new Circle({ radius: 1 }).moveTo([2, 3, 0]);
  const [state] = flipGetState([c]);
  assert.ok(V.equals(state.center as any, c.getCenter(), 1e-9));
  assert.equal(state.width, c.getWidth());
  assert.equal(state.height, c.getHeight());
  assert.equal(state.points.length, c.points.length);
  for (let i = 0; i < c.points.length; i++) {
    assert.deepEqual(state.points[i], c.points[i]);
  }
  // Must be a deep clone, not a reference: mutating the live mobject afterward
  // should not retroactively change the captured snapshot.
  c.shift([100, 0, 0]);
  assert.notDeepEqual(state.center, c.getCenter());
  assert.notDeepEqual(state.points[0], c.points[0]);
});

test("classic FLIP round-trip: animation starts at the captured position and ends at the current (moved) position", () => {
  const c = new Circle({ radius: 1 }).moveTo([0, 0, 0]);
  const state = flipGetState([c]); // position A
  c.moveTo([5, 5, 0]); // instant layout change -> position B
  const anim = flipFrom(state, [c]);

  anim.begin(); // begin() calls setup() then interpolate(0)
  // At alpha=0 the mobject should visually read as being at/near position A.
  assert.ok(V.equals(c.getCenter(), [0, 0, 0], 0.05), `expected ~[0,0,0], got ${c.getCenter()}`);

  anim.interpolateMobject(1);
  // At alpha=1 it should be at its real, current position B.
  assert.ok(V.equals(c.getCenter(), [5, 5, 0], 0.05), `expected ~[5,5,0], got ${c.getCenter()}`);

  // Midpoint should be strictly between A and B (a smooth glide, not a jump).
  anim.interpolateMobject(0.5);
  const mid = c.getCenter();
  assert.ok(mid[0] > 0.5 && mid[0] < 4.5, `midpoint x ${mid[0]} should be strictly between A and B`);
  assert.ok(mid[1] > 0.5 && mid[1] < 4.5, `midpoint y ${mid[1]} should be strictly between A and B`);
});

test("flipFrom on multiple targets animates each from ITS OWN captured state to ITS OWN current state", () => {
  const a = new Circle({ radius: 1 }).moveTo([0, 0, 0]);
  const b = new Square({ sideLength: 1 }).moveTo([10, 0, 0]);

  const state = flipGetState([a, b]); // a at [0,0,0] (A_a), b at [10,0,0] (A_b)
  a.moveTo([3, 0, 0]); // B_a
  b.moveTo([10, 8, 0]); // B_b (only b's position changes)

  const anim = flipFrom(state, [a, b]);
  anim.begin();

  assert.ok(V.equals(a.getCenter(), [0, 0, 0], 0.05), `a should start at its own A, got ${a.getCenter()}`);
  assert.ok(V.equals(b.getCenter(), [10, 0, 0], 0.05), `b should start at its own A, got ${b.getCenter()}`);

  // flipFrom() returns an AnimationGroup for >1 target, whose public dispatch
  // hook is interpolate(alpha) (it delegates to each child's own interpolate),
  // not interpolateMobject (a leaf-only hook AnimationGroup doesn't override).
  anim.interpolate(1);
  assert.ok(V.equals(a.getCenter(), [3, 0, 0], 0.05), `a should end at its own B, got ${a.getCenter()}`);
  assert.ok(V.equals(b.getCenter(), [10, 8, 0], 0.05), `b should end at its own B, got ${b.getCenter()}`);
});

test("flipFrom throws a clear error when state/targets length mismatch", () => {
  const c = new Circle({ radius: 1 });
  const state = flipGetState([c]);
  assert.throws(() => flipFrom(state, [c, new Circle({ radius: 1 })]), RangeError);
});

test("point-count mismatch (structural change) falls back to bbox-rigid interpolation instead of throwing or silently truncating", () => {
  const c = new Circle({ radius: 1 }).moveTo([0, 0, 0]);
  const state = flipGetState([c]); // captures circle's point count + bbox at [0,0,0]

  // Simulate a structural change: swap in a different point count in-place
  // (e.g. what a real layout change that reshapes the mobject would produce),
  // then move it -- this is the "Last" state.
  const square = new Square({ sideLength: 2 }).moveTo([6, 0, 0]);
  c.points = square.points.map((p) => [p[0], p[1], p[2]]);

  const anim = flipFrom(state, [c]);
  assert.doesNotThrow(() => anim.begin());
  // At alpha=0 it should read as being near the captured bbox center, not at
  // the new (Last) center, and should have the SAME point count as the live
  // mobject (no truncation).
  assert.equal(anim.startState.points.length, c.points.length);
  assert.ok(V.equals(c.getCenter(), [0, 0, 0], 0.1), `expected ~[0,0,0] at alpha=0, got ${c.getCenter()}`);

  anim.interpolateMobject(1);
  assert.ok(V.equals(c.getCenter(), [6, 0, 0], 0.1), `expected ~[6,0,0] at alpha=1, got ${c.getCenter()}`);
});

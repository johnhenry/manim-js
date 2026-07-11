// Phase-2 gap-fill for Campaign 7 (GSAP patterns): staggerGrid (grid-aware
// stagger distributions, examples/gsap-parity/ref/02-stagger-distributions.md)
// and MoveAlongPath's autoRotate option
// (examples/gsap-parity/ref/05-motion-path-autorotate.md).

import { test } from "node:test";
import assert from "node:assert/strict";

import { staggerGrid } from "../src/animation/stagger.ts";
import { MoveAlongPath } from "../src/animation/extra.ts";
import { Arc, Line } from "../src/mobject/geometry.ts";
import { linear } from "../src/animation/rate_functions.ts";

// --- staggerGrid -------------------------------------------------------

test("staggerGrid from:'start' gives index 0 the smallest delay and the last cell among the largest", () => {
  const delay = staggerGrid({ grid: [3, 3], from: "start" });
  const delays = Array.from({ length: 9 }, (_, i) => delay(null, i, 9));
  assert.equal(delays[0], 0);
  const max = Math.max(...delays);
  assert.ok(delays[8] >= max - 1e-9, `expected index 8 (bottom-right) near the max, got ${delays[8]} (max ${max})`);
});

test("staggerGrid from:'center' gives the center cell delay 0 and corners the largest delay", () => {
  const delay = staggerGrid({ grid: [3, 3], from: "center" });
  const delays = Array.from({ length: 9 }, (_, i) => delay(null, i, 9));
  assert.ok(delays[4] < 1e-9, `expected center cell (index 4) near 0, got ${delays[4]}`);
  const max = Math.max(...delays);
  for (const i of [0, 2, 6, 8]) {
    assert.ok(Math.abs(delays[i] - max) < 1e-9, `expected corner index ${i} (${delays[i]}) to equal max ${max}`);
  }
});

test("staggerGrid from:'edges' is the inverse of 'center': corners/edges near 0, center is the max", () => {
  const delay = staggerGrid({ grid: [3, 3], from: "edges" });
  const delays = Array.from({ length: 9 }, (_, i) => delay(null, i, 9));
  for (const i of [0, 2, 6, 8]) {
    assert.ok(delays[i] < 1e-9, `expected corner index ${i} near 0, got ${delays[i]}`);
  }
  const max = Math.max(...delays);
  assert.ok(Math.abs(delays[4] - max) < 1e-9, `expected center (index 4) to be the max delay, got ${delays[4]} (max ${max})`);
});

test("staggerGrid from:'random' is deterministic across calls but not monotonic in index", () => {
  const delayA = staggerGrid({ grid: [3, 3], from: "random" });
  const delayB = staggerGrid({ grid: [3, 3], from: "random" });
  const seqA = Array.from({ length: 9 }, (_, i) => delayA(null, i, 9));
  const seqB = Array.from({ length: 9 }, (_, i) => delayB(null, i, 9));
  assert.deepEqual(seqA, seqB, "two independently-constructed factories must agree on the same inputs");

  // Re-sampling the same factory again must give the identical sequence --
  // cache-safety requirement (order-independent, no Math.random drift).
  const seqA2 = Array.from({ length: 9 }, (_, i) => delayA(null, i, 9));
  assert.deepEqual(seqA, seqA2);

  const isMonotonic = seqA.every((v, i) => i === 0 || v >= seqA[i - 1]);
  assert.ok(!isMonotonic, `expected a real (non-sequential) distribution, got ${seqA}`);
});

test("staggerGrid: each scales the normalized delay (default each=1 keeps output in [0,1])", () => {
  const delay = staggerGrid({ grid: [1, 5], from: "start", each: 2 });
  const delays = Array.from({ length: 5 }, (_, i) => delay(null, i, 5));
  assert.equal(delays[0], 0);
  assert.ok(Math.abs(delays[4] - 2) < 1e-9, `expected the farthest cell to reach each*1 = 2, got ${delays[4]}`);
});

// --- MoveAlongPath autoRotate -------------------------------------------

test("MoveAlongPath without autoRotate only translates (no rotation)", () => {
  const arrow = new Line([0, 0, 0], [0.3, 0, 0]);
  const path = new Line([-1, 0, 0], [1, 1, 0]);
  const anim = new MoveAlongPath(arrow, path, { rateFunc: linear });
  anim.begin();
  const angleAtStart = arrow.getAngle();
  anim.interpolate(1);
  assert.ok(Math.abs(arrow.getAngle() - angleAtStart) < 1e-9, "orientation should not change without autoRotate");
});

test("MoveAlongPath autoRotate tracks a straight path's constant tangent direction", () => {
  const arrow = new Line([0, 0, 0], [0.3, 0, 0]); // starts pointing along +X (angle 0)
  const path = new Line([0, 0, 0], [0, 1, 0]); // straight vertical path (tangent angle = 90deg)
  const anim = new MoveAlongPath(arrow, path, { rateFunc: linear, autoRotate: true });
  anim.begin();
  const angleAtZero = arrow.getAngle();
  assert.ok(Math.abs(angleAtZero - Math.PI / 2) < 1e-6, `expected ~90deg, got ${(angleAtZero * 180) / Math.PI}deg`);
  anim.interpolate(0.5);
  anim.interpolate(1);
  const angleAtOne = arrow.getAngle();
  assert.ok(Math.abs(angleAtOne - Math.PI / 2) < 1e-6, "straight path: orientation should stay constant end-to-end");
});

test("MoveAlongPath autoRotate accumulates roughly the path's total turn on a quarter-circle", () => {
  const arrow = new Line([0, 0, 0], [0.2, 0, 0]);
  const path = new Arc({ radius: 1, startAngle: 0, angle: Math.PI / 2 });
  const anim = new MoveAlongPath(arrow, path, { rateFunc: linear, autoRotate: true });

  anim.begin(); // alpha = 0
  const a0 = arrow.getAngle();
  anim.interpolate(0.5);
  const a1 = arrow.getAngle();
  anim.interpolate(1);
  const a2 = arrow.getAngle();

  // The mobject should visibly reorient over the course of the animation,
  // not just translate -- confirm orientation actually changes between samples.
  assert.notEqual(a0, a1);
  assert.notEqual(a1, a2);

  // Total accumulated rotation over the quarter-circle should be roughly the
  // arc's own swept angle (pi/2), within a generous tolerance for a coarse
  // 3-sample check of a curved tangent.
  const totalTurn = Math.abs(a2 - a0);
  assert.ok(Math.abs(totalTurn - Math.PI / 2) < 0.3, `expected ~pi/2 total turn, got ${totalTurn}`);
});

test("MoveAlongPath autoRotateOffset adds a constant offset to the tracked angle", () => {
  const arrow = new Line([0, 0, 0], [0.3, 0, 0]);
  const path = new Line([0, 0, 0], [0, 1, 0]); // tangent angle = 90deg
  const anim = new MoveAlongPath(arrow, path, {
    rateFunc: linear,
    autoRotate: true,
    autoRotateOffset: Math.PI / 2,
  });
  anim.begin();
  const angle = arrow.getAngle();
  assert.ok(Math.abs(angle - Math.PI) < 1e-6, `expected tangent(90deg) + offset(90deg) = 180deg, got ${(angle * 180) / Math.PI}deg`);
});

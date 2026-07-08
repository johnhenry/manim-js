import { test } from "node:test";
import assert from "node:assert/strict";
import { Rapier2DEngine, rapier2d } from "../src/physics/rapier2d.ts";
import { Square } from "../src/mobject/geometry.ts";

// Rapier is an optional dependency; skip the cases that need it when it's absent.
let RAPIER: any = null;
try { RAPIER = await import("@dimforge/rapier2d-compat"); } catch { /* not installed */ }
const maybe = RAPIER
  ? test
  : (name: string, fn: any) => test(name, { skip: "@dimforge/rapier2d-compat not installed" }, () => {});

// (d) Module import must be side-effect-free.
test("rapier2d: module exports are present without initializing WASM", () => {
  assert.equal(typeof rapier2d, "function");
  assert.equal(typeof Rapier2DEngine.create, "function");
});

// (a) A dynamic body falls under gravity.
maybe("rapier2d: a body falls under gravity", async () => {
  const eng = await Rapier2DEngine.create({ gravity: [0, -9.8, 0], rapier: RAPIER });
  const box = new Square({ sideLength: 1 }).moveTo([0, 5, 0]);
  eng.addBody(box, {});
  const y0 = box.getCenter()[1];
  for (let i = 0; i < 30; i++) eng.step(1 / 60);
  assert.ok(box.getCenter()[1] < y0 - 0.1, "box moved down under gravity");
});

// (b) A body rests on the floor without sinking through it.
maybe("rapier2d: a body rests on the floor without sinking", async () => {
  const eng = await Rapier2DEngine.create({ gravity: [0, -9.8, 0], floor: 0, rapier: RAPIER });
  const box = new Square({ sideLength: 2 }).moveTo([0, 3, 0]); // half-extent 1
  eng.addBody(box, {});
  for (let i = 0; i < 240; i++) eng.step(1 / 60);
  const bottom = box.getBoundaryPoint([0, -1, 0])[1];
  assert.ok(bottom > -0.06, `bottom should rest at ~0, got ${bottom}`);
  assert.ok(bottom < 0.2, `bottom should not float above the floor, got ${bottom}`);
});

// (c) Scalar angular velocity rotates the body's points about its center.
maybe("rapier2d: angular velocity rotates the body's points about its center", async () => {
  const eng = await Rapier2DEngine.create({ gravity: [0, 0, 0], rapier: RAPIER });
  const box = new Square({ sideLength: 2 }).moveTo([0, 0, 0]);
  eng.addBody(box, { angularVelocity: 4 });
  const p0 = box.points[0].slice();
  const c0 = box.getCenter();
  for (let i = 0; i < 40; i++) eng.step(1 / 60);
  const p1 = box.points[0];
  const c1 = box.getCenter();
  const moved = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const centerDrift = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
  assert.ok(moved > 0.1, `a corner point should have rotated, moved=${moved}`);
  assert.ok(centerDrift < 0.05, `center should stay put, drift=${centerDrift}`);
});

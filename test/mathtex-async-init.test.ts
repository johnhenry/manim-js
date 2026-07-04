import { test } from "node:test";
import assert from "node:assert/strict";
import { MathTex, initMathTex } from "../src/mobject/mathtex.ts";

// Deliberately NO before(initMathTex) hook here -- this file needs to control
// exactly when (and whether) initMathTex() has resolved, relying on this
// project's own test-runner convention that each test file runs in its own
// process (confirmed via other test files' comments), so nothing here leaks
// into/from other test files sharing the same MathJax singleton.

test("constructing a MathTex before initMathTex() has ever been called throws a clear error", () => {
  assert.throws(
    () => new MathTex("x^2"),
    /call `await initMathTex\(\)` once before constructing/,
    "should throw the documented, actionable error, not a raw MathJax internal failure",
  );
});

test("constructing in the gap between calling initMathTex() and it resolving throws the same clear error", async () => {
  const pending = initMathTex(); // NOT awaited yet
  assert.throws(
    () => new MathTex("x^2"),
    /call `await initMathTex\(\)` once before constructing/,
    "should still throw the clear error, not something confusing, while init is in flight",
  );
  await pending; // let it finish so the next test starts from a clean, resolved state
});

test("after a full await initMathTex(), scale()/moveTo() on a fresh MathTex succeed with sane geometry", async () => {
  await initMathTex();
  const m = new MathTex("x^2").scale(2).moveTo([1, 0, 0]);
  assert.ok(m.submobjects.length >= 2, "should have built real glyph geometry");
  const center = m.getCenter();
  assert.ok(Number.isFinite(center[0]) && Number.isFinite(center[1]));
  assert.ok(Math.abs(center[0] - 1) < 1e-6, "moveTo([1,0,0]) should have taken effect");
  for (const g of m.submobjects) {
    for (const p of g.points) assert.ok(p.every(Number.isFinite), "no NaN/Infinity in glyph geometry");
  }
});

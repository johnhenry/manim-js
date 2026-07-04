import { test } from "node:test";
import assert from "node:assert/strict";
import { running } from "../src/animation/rate_functions.ts";
import { springRate } from "../src/animation/spring.ts";
import { Easing } from "../src/animation/easing.ts";
// Import registry via index.ts (not plugins/registry.ts directly) so
// registerBuiltins()'s side effect (seeding "spring"/"bezier" etc.) has
// actually run before these tests execute.
import { registry } from "../src/index.ts";

// Unifies three previously-disconnected easing systems (rate_functions.ts's
// named registry, easing.ts's bezier combinators, spring.ts's analytic
// spring) under one name-based lookup: running(). registry is a shared
// process-global singleton -- every test here cleans up in a `finally` so
// nothing leaks into other test files sharing the same `node --test` run.

test('running("spring") resolves and roughly matches springRate({}, 60)', () => {
  const viaName = running("spring");
  const direct = springRate({}, 60);
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    assert.ok(Math.abs(viaName(t) - direct(t)) < 1e-9, `mismatch at t=${t}`);
  }
});

test("a registered rate-function factory resolves via colon-parameterized name parsing", () => {
  try {
    registry.registerRateFunctionFactory("__testDouble__", (n) => (t: number) => t * n);
    const fn = running("__testDouble__:3");
    assert.equal(fn(0.5), 1.5);
  } finally {
    registry.rateFunctionFactories.delete("__testDouble__");
  }
});

test('running("bezier:x1,y1,x2,y2") matches Easing.bezier(...) pointwise', () => {
  const viaName = running("bezier:0.4,0,0.2,1");
  const direct = Easing.bezier(0.4, 0, 0.2, 1);
  for (const t of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
    assert.ok(Math.abs(viaName(t) - direct(t)) < 1e-9, `mismatch at t=${t}`);
  }
});

test("a registry override wins over a built-in name", () => {
  try {
    const original = running("linear");
    assert.equal(original(0.3), 0.3);
    registry.registerRateFunction("linear", () => 0.999);
    assert.equal(running("linear")(0.3), 0.999, "registry-registered name should take precedence over the built-in");
  } finally {
    registry.rateFunctions.delete("linear");
    // registerBuiltins() re-seeds "linear" from RATE_FUNCTIONS at import time,
    // so this delete restores lookup to the built-in map's own "linear" entry.
    assert.equal(running("linear")(0.3), 0.3);
  }
});

test("an unregistered factory name with a colon falls back to smooth, not a crash", () => {
  const fn = running("__no_such_factory__:1,2,3");
  assert.equal(typeof fn, "function");
  assert.ok(Number.isFinite(fn(0.5)));
});

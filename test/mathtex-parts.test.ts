import { test, before } from "node:test";
import assert from "node:assert";
import { MathTex, Tex, SingleStringMathTex, initMathTex } from "../src/mobject/mathtex.ts";
import { VGroup } from "../src/mobject/VMobject.ts";
import { RED, BLUE, GREEN } from "../src/core/color.ts";

before(async () => {
  await initMathTex();
});

test("MathTex with multiple tex string args builds addressable parts", () => {
  const m = new MathTex("x^2", "+", "1");
  assert.strictEqual(m.parts.length, 3, "x^2 + 1 should produce exactly 3 parts");
  for (const p of m.parts) assert.ok(p instanceof VGroup);
  // Every part carries at least one glyph.
  assert.ok(m.parts.every((p) => p.submobjects.length > 0));
});

test("getPartByTex returns a VGroup for a matching part", () => {
  const m = new MathTex("x^2", "+", "1");
  const plus = m.getPartByTex("+");
  assert.ok(plus instanceof VGroup, "getPartByTex('+') returns a VGroup");
  assert.ok(plus!.submobjects.length > 0);
  assert.strictEqual(m.getPartByTex("\\notThere"), null);
});

test("getPartsByTex + indexOfPart / indexOfPartByTex", () => {
  const m = new MathTex("x^2", "+", "1");
  const parts = m.getPartsByTex("+");
  assert.strictEqual(parts.length, 1);
  assert.strictEqual(m.indexOfPart(parts[0]), 1);
  assert.strictEqual(m.indexOfPartByTex("1"), 2);
});

test("setColorByTex colors all glyphs of the matching part", () => {
  const m = new MathTex("x^2", "+", "1");
  m.setColorByTex("x", RED);
  const xPart = m.getPartByTex("x");
  assert.ok(xPart);
  const redHex = RED.toUpperCase();
  for (const g of xPart!.submobjects) {
    assert.strictEqual((g as any).fillColor.toHex().toUpperCase(), redHex);
  }
});

test("texToColorMap colors matching parts on construction", () => {
  const m = new MathTex("x^2", "+", "1", { texToColorMap: { "+": BLUE, "1": GREEN } });
  const plus = m.getPartByTex("+")!;
  const one = m.getPartByTex("1")!;
  assert.strictEqual(plus.submobjects[0].fillColor.toHex().toUpperCase(), BLUE.toUpperCase());
  assert.strictEqual(one.submobjects[0].fillColor.toHex().toUpperCase(), GREEN.toUpperCase());
});

test("substringsToIsolate splits a single string into parts", () => {
  const m = new MathTex("x+y+z", { substringsToIsolate: ["+"] });
  // x, +, y, +, z  -> 5 parts
  assert.strictEqual(m.parts.length, 5, "isolating '+' in x+y+z yields 5 parts");
  const plusParts = m.getPartsByTex("+");
  assert.strictEqual(plusParts.length, 2);
});

test("setOpacityByTex + sortAlphabetically do not throw", () => {
  const m = new MathTex("b", "a", "c");
  m.setOpacityByTex("a", 0.3);
  m.sortAlphabetically();
  assert.ok(m.parts.length === 3);
});

test("SingleStringMathTex renders one string to glyphs", () => {
  const s = new SingleStringMathTex("x^2");
  assert.ok(s.submobjects.length >= 2);
  assert.ok(s.getHeight() > 0);
});

test("legacy single-string MathTex keeps flat glyph submobjects", () => {
  const m = new MathTex("x^2", { fontSize: 1 });
  // Backwards compatible: submobjects are the glyphs, not part-VGroups.
  assert.ok(m.submobjects.length >= 2);
  assert.ok(m.submobjects.every((g) => g.points.every((p) => p.every(Number.isFinite))));
});

test("Tex renders upright text and builds glyphs", () => {
  const t = new Tex("hello");
  assert.ok(t.glyphs().length > 0, "Tex('hello') builds >0 glyphs");
  assert.ok(t.getHeight() > 0);
});

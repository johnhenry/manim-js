import { test, before } from "node:test";
import assert from "node:assert/strict";
import { MathTex, initMathTex } from "../src/mobject/mathtex.ts";

// The glyph-count "part" matching (mathtex.ts's countGlyphs()/MathTex
// constructor, ~lines 458-548) is self-documented as a trust boundary: it
// renders each part-substring independently and trusts MathJax to be
// deterministic about glyph counts summing back to the full expression's
// count, "instead of SVG-path matching." If the counts don't reconcile, it
// silently falls back to ONE part holding every glyph -- a real degradation
// (getPartByTex/setColorByTex on individual pieces stop working) that
// produces no error, so it's easy to ship unnoticed. These tests pin the
// *expected* part count for exactly the fragile cases the code comment
// names (spacing/kerning glyphs, \text runs) against the pinned mathjax-full
// version in package.json -- re-verify this file before bumping that
// dependency.

before(async () => {
  await initMathTex();
});

test("a fraction reconciles into 2 addressable parts (numerator, denominator)", () => {
  const m = new MathTex("\\frac{a}{b}", "=", "1");
  assert.equal(m.parts.length, 3, "\\frac{a}{b} = 1 should reconcile into exactly 3 top-level parts");
  assert.ok(m.parts.every((p) => p.submobjects.length > 0), "no part should have silently absorbed zero glyphs");
});

test("stacked sub/superscripts reconcile correctly", () => {
  const m = new MathTex("x_{i}^{2}", "+", "y_{j}^{3}");
  assert.equal(m.parts.length, 3);
  for (const p of m.parts) assert.ok(p.submobjects.length > 0);
});

test("\\text{} runs mixed with math reconcile without falling back to one part", () => {
  const m = new MathTex("\\text{let } x", "=", "\\text{5}");
  assert.equal(m.parts.length, 3, "text runs mixed with math must not collapse into a single fallback part");
});

test("multiple substringsToIsolate combined with texToColorMap reconcile", () => {
  const m = new MathTex("a+b-c", {
    substringsToIsolate: ["+", "-"],
    texToColorMap: { a: "#FF0000", c: "#00FF00" },
  });
  // a, +, b, -, c -> 5 parts
  assert.equal(m.parts.length, 5);
  const aPart = m.getPartByTex("a")!;
  const cPart = m.getPartByTex("c")!;
  assert.ok(aPart && aPart.submobjects.length > 0);
  assert.ok(cPart && cPart.submobjects.length > 0);
});

test("a longer mixed expression (fraction + superscript + text) still reconciles", () => {
  const m = new MathTex("\\frac{x^2}{2}", "+", "\\text{const}");
  assert.equal(m.parts.length, 3);
  for (const p of m.parts) assert.ok(p.submobjects.length > 0);
});

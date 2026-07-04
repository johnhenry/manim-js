// glyphsFromDomSvg() is the glyph-extraction path used when MathTex falls
// back to CDN-loaded MathJax (a real browser Element tree, not mathjax-full's
// lite-adaptor virtual DOM) -- see src/mobject/mathtex.ts. Tested here with a
// hand-built fake element tree (plain objects satisfying {tagName,
// getAttribute, children}) so it's exercised deterministically in plain
// Node, without needing jsdom or a real browser.

import { test } from "node:test";
import assert from "node:assert/strict";
import { glyphsFromDomSvg } from "../src/mobject/mathtex.ts";

function fakeEl(tagName: string, attrs: Record<string, string> = {}, children: any[] = []): any {
  return {
    tagName,
    getAttribute: (name: string) => (name in attrs ? attrs[name] : null),
    children,
  };
}

test("glyphsFromDomSvg resolves a <use href> against a <defs><path>", () => {
  const path = fakeEl("path", { id: "g1", d: "M0 0 L10 0 L10 10 L0 10 Z" });
  const defs = fakeEl("defs", {}, [path]);
  const use = fakeEl("use", { href: "#g1" });
  const svg = fakeEl("svg", {}, [defs, use]);

  const glyphs = glyphsFromDomSvg(svg, { color: "#ff0000" });
  assert.equal(glyphs.length, 1);
  assert.ok(glyphs[0].points.length > 0, "resolved glyph should have real points");
  assert.equal(glyphs[0].fillColor.toHex(), "#ff0000");
});

test("glyphsFromDomSvg also resolves the xlink:href variant (older MathJax output)", () => {
  const path = fakeEl("path", { id: "g2", d: "M0 0 L10 0 L10 10 L0 10 Z" });
  const defs = fakeEl("defs", {}, [path]);
  const use = fakeEl("use", { "xlink:href": "#g2" });
  const svg = fakeEl("svg", {}, [defs, use]);

  const glyphs = glyphsFromDomSvg(svg);
  assert.equal(glyphs.length, 1);
  assert.ok(glyphs[0].points.length > 0);
});

test("glyphsFromDomSvg applies a <use>'s x/y offset to the resolved glyph's points", () => {
  const path = fakeEl("path", { id: "g3", d: "M0 0 L10 0 L10 10 L0 10 Z" });
  const defs = fakeEl("defs", {}, [path]);
  const useAtOrigin = fakeEl("use", { href: "#g3" });
  const useOffset = fakeEl("use", { href: "#g3", x: "100", y: "0" });

  const glyphsOrigin = glyphsFromDomSvg(fakeEl("svg", {}, [defs, useAtOrigin]));
  const glyphsOffset = glyphsFromDomSvg(fakeEl("svg", {}, [defs, useOffset]));
  // Both glyphs have the same shape, only translated in x -- their first
  // point's x coordinate should differ by the offset (scaled by mathtex's
  // internal UNIT = 1/1000, applied identically to both).
  const dx = glyphsOffset[0].points[0][0] - glyphsOrigin[0].points[0][0];
  assert.ok(Math.abs(dx - 0.1) < 1e-9, `expected dx~=0.1 (100 * UNIT), got ${dx}`);
});

test("glyphsFromDomSvg turns a <rect> record into a filled 4-corner subpath", () => {
  const rect = fakeEl("rect", { x: "0", y: "0", width: "20", height: "2" });
  const svg = fakeEl("svg", {}, [rect]);

  const glyphs = glyphsFromDomSvg(svg, { color: "#00ff00" });
  assert.equal(glyphs.length, 1);
  assert.equal(glyphs[0].fillColor.toHex(), "#00ff00");
  assert.ok(glyphs[0].points.length >= 4, "a rectangle should produce at least 4 points");
});

test("glyphsFromDomSvg skips <defs> content itself (only resolves through <use>)", () => {
  // A lone, unreferenced <defs><path> must not itself become a visible glyph.
  const path = fakeEl("path", { id: "g4", d: "M0 0 L10 0 L10 10 L0 10 Z" });
  const defs = fakeEl("defs", {}, [path]);
  const svg = fakeEl("svg", {}, [defs]);

  const glyphs = glyphsFromDomSvg(svg);
  assert.equal(glyphs.length, 0, "an unreferenced <defs> path produces no visible glyph");
});

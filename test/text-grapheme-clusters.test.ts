import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import opentype from "opentype.js";
import { buildGlyphRun } from "../src/mobject/text_shaping.ts";
import { Text } from "../src/mobject/text/Text.ts";
import { resolveFontPath } from "../src/node.ts";

// Grapheme-cluster iteration: buildGlyphRun segments by Intl.Segmenter
// (grapheme mode) instead of raw code points, merging a base glyph and any
// combining marks into one VMobject/cluster -- otherwise a combining-mark
// sequence like "e" + U+0301 (combining acute) would previously produce two
// *separate*, independently-positioned glyph mobjects (and worse, since
// opentype.js's charToGlyph/getPath only reads whichever single code point
// it's given, a naive "one loop iteration per Intl.Segmenter cluster" fix
// would still drop the mark entirely unless every code point in the cluster
// gets its own glyph lookup merged into one mobject, which is what this
// module actually does).
//
// All combining/ZWJ code points below are explicit \u escapes, not literal
// typed characters, so the test doesn't depend on whether this source file
// happens to store a precomposed or decomposed form.

const COMBINING_ACUTE = "́";
const E_ACUTE_DECOMPOSED = "e" + COMBINING_ACUTE; // NOT the precomposed U+00E9
const ZWJ = "‍";
const ZWJ_FAMILY = "\u{1F468}" + ZWJ + "\u{1F469}" + ZWJ + "\u{1F467}"; // man+ZWJ+woman+ZWJ+girl

function loadRealFont() {
  const path = resolveFontPath();
  if (!path) return null;
  const buf = readFileSync(path);
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

test('"e" + combining acute merges into exactly one cluster, with both glyphs drawn', () => {
  const font = loadRealFont();
  if (!font) return; // no system font in this environment

  const { entries } = buildGlyphRun(E_ACUTE_DECOMPOSED, { font, px: 100, scaleToWorld: 1 });
  assert.equal(entries.length, 1, "base + combining mark should be ONE cluster entry, not two");

  const merged = entries[0].mob;
  const { entries: baseOnly } = buildGlyphRun("e", { font, px: 100, scaleToWorld: 1 });
  const baseSubpathCount = baseOnly[0].mob.subpathStarts.length;
  assert.ok(
    merged.subpathStarts.length > baseSubpathCount,
    "merged cluster must include the combining mark's own subpaths, not just the base glyph's " +
      `(base had ${baseSubpathCount} subpaths, merged had ${merged.subpathStarts.length})`,
  );
  assert.equal(entries[0].clusterLength, E_ACUTE_DECOMPOSED.length, "clusterLength should span both code units");
});

test("a ZWJ emoji sequence counts as exactly one cluster", () => {
  const font = loadRealFont();
  if (!font) return;

  const { entries } = buildGlyphRun(ZWJ_FAMILY, { font, px: 100, scaleToWorld: 1 });
  assert.equal(entries.length, 1, "a ZWJ sequence must be treated as one grapheme cluster");
  assert.equal(entries[0].clusterLength, ZWJ_FAMILY.length);
  // Don't assert on visual content -- a non-emoji system font legitimately
  // has no glyphs for these code points, which is fine; only cluster-count
  // (not rendered content) is font-independent here.
});

test("getPartByText still finds substrings spanning a combining-mark cluster", () => {
  const path = resolveFontPath();
  if (!path) return;

  const source = "caf" + E_ACUTE_DECOMPOSED + " time"; // "café time", NFD-decomposed
  const t = new Text(source, { fontSize: 0.5 });
  if ((t as any)._isText) return; // raster fallback in this environment; nothing vector to check

  // source.length counts "e"+combining-acute as 2 code units, but they
  // collapse to a single glyph slot -- one fewer chars entry than the raw
  // string length.
  assert.equal(t.chars.submobjects.length, source.length - 1);

  const part = t.getPartByText(E_ACUTE_DECOMPOSED);
  assert.ok(part.submobjects.length >= 1, "should find the é cluster as a substring match");

  const wordPart = t.getPartByText("time");
  assert.equal(wordPart.submobjects.length, 4, "an unrelated substring after the cluster should still match cleanly");
});

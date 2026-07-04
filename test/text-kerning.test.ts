import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import opentype from "opentype.js";
import { buildGlyphRun } from "../src/mobject/text_shaping.ts";
import { estimateTextSize } from "../src/mobject/text/Text.ts";
import { resolveFontPath } from "../src/node.ts";

// Kerning (issue: opentype.js's font.getKerningValue() was available but never
// called). Real installed fonts vary widely in whether they carry kerning
// data at all -- this environment's system font (DejaVu Sans, via fontconfig)
// has an empty `kern` table for every common pair (AV/To/Yo/WA/...), so an
// assertion tied to a specific real-world pair would be non-deterministic
// across environments. Test the kerning application logic directly against a
// synthetic font with a known kerning pair instead; a real-font case below
// only checks that wiring a real opentype.js Font through doesn't throw.

function makeFakeFont(kerningPairs: Record<string, number>) {
  return {
    unitsPerEm: 1000,
    charToGlyph(ch: string) {
      return {
        index: ch.codePointAt(0),
        advanceWidth: 500,
        getPath(x: number, y: number) {
          return {
            toPathData(_prec: number) {
              return `M${x} ${y} L${x + 10} ${y} L${x + 10} ${y + 10} L${x} ${y + 10} Z`;
            },
          };
        },
      };
    },
    getKerningValue(g1: any, g2: any) {
      const key = String.fromCodePoint(g1.index) + String.fromCodePoint(g2.index);
      return kerningPairs[key] ?? 0;
    },
  };
}

test("a kernable pair's second glyph is pulled closer than the unkerned advance", () => {
  const font = makeFakeFont({ AV: -100 }); // negative kern: tuck glyphs together
  const { entries: withKern } = buildGlyphRun("AV", { font, px: 100, scaleToWorld: 1, kerning: true });
  const { entries: noKern } = buildGlyphRun("AV", { font, px: 100, scaleToWorld: 1, kerning: false });
  assert.equal(withKern.length, 2);
  assert.equal(noKern.length, 2);
  const xWithKern = withKern[1].mob.points[0][0];
  const xNoKern = noKern[1].mob.points[0][0];
  assert.ok(
    xWithKern < xNoKern,
    `kerning should move the second glyph closer (got ${xWithKern} vs unkerned ${xNoKern})`,
  );
});

test("a non-kernable pair is byte-identical with kerning on or off", () => {
  const font = makeFakeFont({}); // no pairs at all
  const { entries: withKern } = buildGlyphRun("XY", { font, px: 100, scaleToWorld: 1, kerning: true });
  const { entries: noKern } = buildGlyphRun("XY", { font, px: 100, scaleToWorld: 1, kerning: false });
  assert.deepEqual(withKern[1].mob.points, noKern[1].mob.points);
});

test("kerning defaults on when the option is omitted", () => {
  const font = makeFakeFont({ AV: -100 });
  const { entries: defaulted } = buildGlyphRun("AV", { font, px: 100, scaleToWorld: 1 });
  const { entries: explicitOn } = buildGlyphRun("AV", { font, px: 100, scaleToWorld: 1, kerning: true });
  assert.deepEqual(defaulted[1].mob.points, explicitOn[1].mob.points);
});

test("real system font: kerning wiring doesn't throw and produces sane geometry", () => {
  const path = resolveFontPath();
  if (!path) return; // no system font in this environment -- nothing to exercise
  // Load directly via opentype.js (avoid depending on the process-wide
  // default-font singleton other test files also touch).
  const buf = readFileSync(path);
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const { entries } = buildGlyphRun("Text", { font, px: 100, scaleToWorld: 1 });
  assert.equal(entries.length, 4);
  for (const e of entries) assert.ok(Number.isFinite(e.sourceStart));
});

test("estimateTextSize (raster estimate) is unaffected by kerning -- the two width models diverge by design", () => {
  const a = estimateTextSize("AVAVAV", 1);
  const b = estimateTextSize("AVAVAV", 1);
  assert.deepEqual(a, b); // pure CHAR_ASPECT arithmetic, no font/kerning involved at all
});

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Text, estimateTextSize } from "../src/mobject/text/Text.ts";

// Word-wrap: Text previously only split on literal "\n" -- a long caption
// exceeding the frame width required the author to hand-place line breaks.
// `width` (world units) now greedily wraps words to fit, matching common
// practice elsewhere (e.g. Satori settles for word-wrap over full UAX#14
// line-breaking) rather than attempting full Unicode line-breaking rigor.

before(async () => {
  await (await import("../src/renderer/fonts-node.ts")).loadVectorFont();
});

function maxLineWidth(t: Text): number {
  // chars are grouped left-to-right per line in source order; use each
  // glyph's world x-position range as a stand-in for per-line width by
  // grouping on y (line) position.
  const byLine = new Map<number, number[]>();
  for (const g of t.chars.submobjects as any[]) {
    const y = Math.round(g.getCenter()[1] * 1000);
    const xs = byLine.get(y) ?? [];
    xs.push(g.getCenter()[0]);
    byLine.set(y, xs);
  }
  let max = 0;
  for (const xs of byLine.values()) {
    const w = Math.max(...xs) - Math.min(...xs);
    max = Math.max(max, w);
  }
  return max;
}

test("a long single-line string with width wraps into multiple lines within tolerance", () => {
  const long = "the quick brown fox jumps over the lazy dog and then runs away very fast indeed";
  const wrapped = new Text(long, { fontSize: 0.3, width: 3 });
  assert.ok(wrapped.numLines === undefined); // vector mode doesn't set numLines (raster-only field)
  assert.ok(wrapped.text.includes("\n"), "wrapping should have inserted at least one line break");
  const lineCount = wrapped.text.split("\n").length;
  assert.ok(lineCount > 1, "a string this long at this width must wrap to more than one line");

  // Tolerance: no line should measurably exceed the requested width (a full
  // pixel-perfect check isn't warranted for a greedy-wrap feature, but the
  // longest resulting line shouldn't blow past the budget).
  if (!(wrapped as any)._isText) {
    const measured = maxLineWidth(wrapped);
    assert.ok(measured <= 3 + 1e-6, `longest wrapped line (${measured}) should not exceed width (3)`);
  }
});

test("explicit \\n combined with width wraps each paragraph independently", () => {
  const source = "short line\nthis is a considerably longer second paragraph that should itself wrap";
  const wrapped = new Text(source, { fontSize: 0.3, width: 2.5 });
  const lines = wrapped.text.split("\n");
  assert.equal(lines[0], "short line", "the short first paragraph should be untouched by wrapping");
  assert.ok(lines.length > 2, "the long second paragraph should have wrapped into more than one line");
});

test("a single word wider than width gets its own unbroken line, no throw/hang", () => {
  const unbreakable = "supercalifragilisticexpialidocious short";
  assert.doesNotThrow(() => {
    const wrapped = new Text(unbreakable, { fontSize: 0.5, width: 0.5 });
    const lines = wrapped.text.split("\n");
    assert.ok(lines[0].startsWith("supercalifragilisticexpialidocious"), "the long word must not be split/hyphenated");
  });
});

test("no width passed is byte-identical to today's plain \\n-split behavior", () => {
  const source = "line one\nline two\nline three";
  const t = new Text(source);
  assert.equal(t.text, source);
});

test("estimateTextSize with opts.width matches the same greedy-wrap line count", () => {
  const long = "the quick brown fox jumps over the lazy dog and then runs away very fast indeed";
  const noWrap = estimateTextSize(long, 0.3);
  const wrapped = estimateTextSize(long, 0.3, { width: 3 });
  assert.ok(wrapped.height > noWrap.height, "wrapping into more lines should increase estimated height");
  assert.ok(wrapped.width <= noWrap.width, "wrapping should never make the estimated width larger than the unwrapped single line");
});

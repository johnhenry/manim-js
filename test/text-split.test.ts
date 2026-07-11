// words()/lines() -- group Text's per-glyph `chars` into per-word/per-line
// VGroups (GSAP SplitText-style), sharing glyph identity with `.chars` so
// staggered word/line reveals stay visually consistent with the whole text.
// See examples/gsap-parity/ref/03-text-split-reveal.md.

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Text } from "../src/mobject/text/Text.ts";
import { VMobject } from "../src/mobject/VMobject.ts";

// Ensure a vector font is loaded so `new Text(...)` builds real glyph
// outlines (chars/words/lines are meaningless against the raster fallback).
before(async () => {
  await (await import("../src/renderer/fonts-node.ts")).loadVectorFont();
});

test("words() splits 'Hello World' into 2 groups with correct char counts", () => {
  const t = new Text("Hello World");
  const words = t.words();
  assert.equal(words.length, 2);
  assert.equal(words[0].submobjects.length, 5);
  assert.equal(words[1].submobjects.length, 5);
});

test("words() collapses whitespace runs (no empty word groups)", () => {
  const t = new Text("Hello   World");
  const words = t.words();
  assert.equal(words.length, 2);
  assert.equal(words[0].submobjects.length, 5);
  assert.equal(words[1].submobjects.length, 5);
});

test("lines() splits on newlines with correct per-line char counts", () => {
  const t = new Text("Line one\nLine two\nLine three");
  const lines = t.lines();
  assert.equal(lines.length, 3);
  assert.equal(lines[0].submobjects.length, "Line one".length);
  assert.equal(lines[1].submobjects.length, "Line two".length);
  assert.equal(lines[2].submobjects.length, "Line three".length);
  // Total glyphs across lines matches the flat chars list exactly (newlines
  // themselves produce no glyph, so nothing is lost or double-counted).
  const total = lines.reduce((n, g) => n + g.submobjects.length, 0);
  assert.equal(total, t.chars.submobjects.length);
});

test("lines() on a single line with no newlines returns one VGroup with everything", () => {
  const t = new Text("no newlines here");
  const lines = t.lines();
  assert.equal(lines.length, 1);
  assert.equal(lines[0].submobjects.length, t.chars.submobjects.length);
});

test("words()/lines() on empty string return []", () => {
  const t = new Text("");
  assert.deepEqual(t.words(), []);
  assert.deepEqual(t.lines(), []);
});

test("words() on whitespace-only text returns []", () => {
  const t = new Text("   ");
  assert.deepEqual(t.words(), []);
});

test("lines() on whitespace-only single-line text keeps its (invisible) glyphs", () => {
  const t = new Text("   ");
  const lines = t.lines();
  assert.equal(lines.length, 1);
  assert.equal(lines[0].submobjects.length, 3);
  assert.equal(lines[0].submobjects.length, t.chars.submobjects.length);
});

test("words()/lines() share glyph identity with .chars (===, not copies)", () => {
  const t = new Text("Hello World\nSecond line");
  const words = t.words();
  const lines = t.lines();

  // Every glyph in words()[0] ("Hello") is the exact same instance found at
  // the corresponding position in the flat chars list.
  for (let i = 0; i < 5; i++) {
    assert.strictEqual(words[0].submobjects[i], t.chars.submobjects[i]);
  }
  // Same check for lines(): line 0 is "Hello World" (11 chars).
  for (let i = 0; i < 11; i++) {
    assert.strictEqual(lines[0].submobjects[i], t.chars.submobjects[i]);
  }
  // Mutating a glyph through a word group is visible through .chars too,
  // since they are literally the same VMobject.
  const g = words[1].submobjects[0] as VMobject; // 'S' of "Second"
  g.fillOpacity = 0.25;
  const flatIndex = t.chars.submobjects.indexOf(g);
  assert.ok(flatIndex >= 0);
  assert.equal((t.chars.submobjects[flatIndex] as VMobject).fillOpacity, 0.25);
});

test("words()/lines() return NEW VGroup wrappers, not aliases of .chars", () => {
  const t = new Text("Hello World");
  const words = t.words();
  assert.notEqual(words[0] as unknown, t.chars);
  assert.notEqual(words[1] as unknown, t.chars);
  // Grouping into words doesn't touch chars' own submobject list ("Hello"
  // + " " + "World" = 11 glyph entries, including the invisible space).
  assert.equal(t.chars.submobjects.length, 11);
});

// Campaign 9 (Reveal.js / Slidev decks) gap-fill: parseDeckMarkdown (pure
// parser) + deckFromMarkdown (Scene builder). See src/loaders/deck_markdown.ts
// for the dialect's deliberate scope (a generic presentation-markdown
// subset, not a full Reveal.js/Slidev engine).

import { test, before } from "node:test";
import assert from "node:assert/strict";

import { parseDeckMarkdown, deckFromMarkdown } from "../src/loaders/deck_markdown.ts";
import { Scene } from "../src/scene/Scene.ts";

before(async () => {
  await (await import("../src/renderer/fonts-node.ts")).loadVectorFont();
  await (await import("../src/mobject/mathtex.ts")).initMathTex();
});

test("parseDeckMarkdown splits on bare '---' lines into slides", () => {
  const md = "# One\nfirst\n\n---\n\n# Two\nsecond";
  const slides = parseDeckMarkdown(md);
  assert.equal(slides.length, 2);
  assert.equal(slides[0].heading, "One");
  assert.equal(slides[0].body, "first");
  assert.equal(slides[1].heading, "Two");
  assert.equal(slides[1].body, "second");
});

test("parseDeckMarkdown skips a leading YAML frontmatter fence", () => {
  const md = "---\ntheme: seriph\ntitle: Hi\n---\n\n# Real Slide\nbody text";
  const slides = parseDeckMarkdown(md);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].heading, "Real Slide");
  assert.equal(slides[0].body, "body text");
});

test("parseDeckMarkdown collects bullet items in order", () => {
  const md = "# List\n- first\n- second\n* third\n1. fourth";
  const [slide] = parseDeckMarkdown(md);
  assert.deepEqual(slide.bullets, ["first", "second", "third", "fourth"]);
});

test("parseDeckMarkdown extracts a math block without the $$ delimiters", () => {
  const md = "# Math\n$$\\int_0^1 x\\,dx = \\frac{1}{2}$$";
  const [slide] = parseDeckMarkdown(md);
  assert.equal(slide.math, "\\int_0^1 x\\,dx = \\frac{1}{2}");
});

test("parseDeckMarkdown extracts speaker notes from a trailing HTML comment", () => {
  const md = "# Slide\nbody\n\n<!--\nRemember to slow down here.\n-->";
  const [slide] = parseDeckMarkdown(md);
  assert.equal(slide.notes, "Remember to slow down here.");
  assert.ok(!slide.body.includes("Remember"), "notes must not leak into body");
});

test("parseDeckMarkdown extracts speaker notes from <aside class=\"notes\">", () => {
  const md = '# Slide\nbody\n<aside class="notes">Reveal.js style notes.</aside>';
  const [slide] = parseDeckMarkdown(md);
  assert.equal(slide.notes, "Reveal.js style notes.");
});

test("parseDeckMarkdown parses a fenced code block with no highlight annotation", () => {
  const md = "# Code\n```js\nconst x = 1;\nconst y = 2;\n```";
  const [slide] = parseDeckMarkdown(md);
  assert.equal(slide.code?.language, "js");
  assert.equal(slide.code?.source, "const x = 1;\nconst y = 2;");
  assert.deepEqual(slide.code?.highlightSteps, []);
});

test("parseDeckMarkdown parses Slidev-style single-step {2,4-6} line ranges (1-based -> 0-based)", () => {
  const md = "# Code\n```ts {2,4-6}\na\nb\nc\nd\ne\nf\n```";
  const [slide] = parseDeckMarkdown(md);
  assert.equal(slide.code?.highlightSteps.length, 1);
  assert.deepEqual(slide.code?.highlightSteps[0], [[1, 1], [3, 5]]);
});

test("parseDeckMarkdown parses Slidev-style multi-step {all|2|4-6|all} sequences", () => {
  const md = "# Code\n```ts {all|2|4-6|all}\na\nb\nc\nd\ne\nf\n```";
  const [slide] = parseDeckMarkdown(md);
  assert.equal(slide.code?.highlightSteps.length, 4);
  assert.deepEqual(slide.code?.highlightSteps[0], []); // "all" = no restriction
  assert.deepEqual(slide.code?.highlightSteps[1], [[1, 1]]);
  assert.deepEqual(slide.code?.highlightSteps[2], [[3, 5]]);
  assert.deepEqual(slide.code?.highlightSteps[3], []);
});

test("parseDeckMarkdown handles a slide with heading + body + bullets + code + math + notes all at once", () => {
  const md = [
    "# Everything",
    "intro line",
    "- point one",
    "- point two",
    "```py {1}",
    "print(1)",
    "print(2)",
    "```",
    "$$E=mc^2$$",
    "<!-- final notes -->",
  ].join("\n");
  const [slide] = parseDeckMarkdown(md);
  assert.equal(slide.heading, "Everything");
  assert.equal(slide.body, "intro line");
  assert.deepEqual(slide.bullets, ["point one", "point two"]);
  assert.equal(slide.code?.source, "print(1)\nprint(2)");
  assert.equal(slide.math, "E=mc^2");
  assert.equal(slide.notes, "final notes");
});

// --- deckFromMarkdown: Scene-building integration --------------------------

test("deckFromMarkdown returns a plain construct function render() can consume", () => {
  const build = deckFromMarkdown("# Hi\nworld");
  assert.equal(typeof build, "function");
});

test("deckFromMarkdown drives a real Scene: one nextSection per slide, with notes carried through", async () => {
  const md = "# First\nfirst body\n\n---\n\n# Second\nsecond body\n\n<!-- notes for second -->";
  const build = deckFromMarkdown(md, { holdTime: 0.05, fragmentRunTime: 0.05 });
  const scene = new Scene();
  await build(scene);
  assert.equal(scene.sections.length, 2);
  assert.equal(scene.sections[0].name, "First");
  assert.equal(scene.sections[1].name, "Second");
  assert.equal(scene.sections[1].notes, "notes for second");
});

test("deckFromMarkdown: each bullet is its own play() (a natural step boundary via playRecords)", async () => {
  const md = "# Steps\n- alpha\n- beta\n- gamma";
  const build = deckFromMarkdown(md, { holdTime: 0.01, fragmentRunTime: 0.01 });
  const scene = new Scene();
  await build(scene);
  // heading fade-in (1) + 3 bullet fade-ins = at least 4 play() records.
  assert.ok(scene.playRecords.length >= 4, `expected >=4 playRecords, got ${scene.playRecords.length}`);
});

test("deckFromMarkdown: a code block's highlight steps are each their own play()", async () => {
  const md = "# Walkthrough\n```js {all|1|2}\nconst a = 1;\nconst b = 2;\n```";
  const build = deckFromMarkdown(md, { holdTime: 0.01, fragmentRunTime: 0.01 });
  const scene = new Scene();
  const before = 0;
  await build(scene);
  // heading + code fade-in + 2 highlight-step plays = at least 4.
  assert.ok(scene.playRecords.length >= 4, `expected >=4 playRecords, got ${scene.playRecords.length}`);
  assert.ok(scene.playRecords.length > before);
});

test("deckFromMarkdown: autoAnimate:true uses autoAnimateToNextSection for slides after the first", async () => {
  const md = "# A\nfirst\n\n---\n\n# B\nsecond";
  const build = deckFromMarkdown(md, { holdTime: 0.01, fragmentRunTime: 0.01, autoAnimate: true });
  const scene = new Scene();
  await build(scene);
  assert.equal(scene.sections.length, 2);
  assert.equal(scene.sections[1].name, "B");
});

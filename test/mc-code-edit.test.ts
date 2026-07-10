// MC3 (Motion Canvas parity campaign): Code tagged-template edits
// (insert/remove/edit markers), selection (lines/word/findFirstRange with
// dimming), and instant mutators (replace/prepend/append/setCode).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Code, lines, word, insert, remove, edit,
} from "../src/mobject/text/code.ts";
import { AnimationGroup } from "../src/animation/composition.ts";
import { Scene } from "../src/scene/Scene.ts";

const close = (a: number, b: number, eps = 1e-6, msg?: string) =>
  assert.ok(Math.abs(a - b) < eps, msg ?? `${a} !~ ${b}`);

const silentScene = () => new Scene({ fps: 20, frameHandler: async () => {} });

// --- edit tagged template ------------------------------------------------

test("edit template derives before/after and returns a diff animation + target", () => {
  const code = new Code("const x = 1;", { lineNumbers: false });
  const { animation, target } = code.edit(0.8)`const x = ${edit("1", "2")};${insert(" // two")}`;
  assert.ok(animation instanceof AnimationGroup);
  close(animation.runTime, 0.8, 1e-9, "duration flows to the animation");
  assert.ok(target instanceof Code);
  assert.equal(target.codeString, "const x = 2; // two");
});

test("insert/remove markers shape only the side they belong to", () => {
  const code = new Code("a\nb", { lineNumbers: false });
  const result: any = code.edit()`a${remove("\nb")}${insert("\nc")}`;
  assert.equal(result.before, "a\nb", "remove text present before");
  assert.equal(result.target.codeString, "a\nc", "insert text present after");
});

test("edit target stays anchored at the source's top-left", () => {
  const code = new Code("let a = 1;\nlet b = 2;", { lineNumbers: false });
  code.moveTo([2, 1, 0]);
  const { target } = code.edit()`let a = 1;\nlet b = ${edit("2", "222222")};`;
  const srcUL = code.getCorner([-1, 1, 0]);
  const dstUL = target.getCorner([-1, 1, 0]);
  close(srcUL[0], dstUL[0], 1e-6, "left edges align");
  close(srcUL[1], dstUL[1], 1e-6, "top edges align");
});

test("edit animation plays through a scene", async () => {
  const scene = silentScene();
  const code = new Code("x = 1", { lineNumbers: false, language: "python" });
  scene.add(code);
  const { animation } = code.edit(0.2)`x = ${edit("1", "42")}`;
  await scene.play(animation);
  assert.ok(true, "played to completion");
});

// --- selection -------------------------------------------------------------

test("selection(lines(...)) dims tokens outside the range", async () => {
  const scene = silentScene();
  const code = new Code("aaa\nbbb\nccc", { lineNumbers: false });
  scene.add(code);
  await scene.play(code.selection(lines(1), 0.1));
  const toks = code.codeTokens.submobjects as any[];
  const byLine = (line: number) => toks.filter((_t, i) => (code as any)._tokenLoc[i].line === line);
  assert.ok(byLine(1).every((t) => (t.opacity ?? 1) > 0.9), "selected line stays bright");
  assert.ok(byLine(0).every((t) => (t.opacity ?? 1) < 0.3), "line above dims");
  assert.ok(byLine(2).every((t) => (t.opacity ?? 1) < 0.3), "line below dims");

  await scene.play(code.selection(null, 0.1));
  assert.ok(toks.every((t) => (t.opacity ?? 1) > 0.99), "selection(null) restores");
});

test("word() and multiple ranges select precisely", async () => {
  const scene = silentScene();
  const code = new Code("foo bar\nbaz qux", { lineNumbers: false });
  scene.add(code);
  await scene.play(code.selection([word(0, 4, 3), lines(1)], 0.1));
  const toks = code.codeTokens.submobjects as any[];
  const tokAt = (line: number, text: string) =>
    toks.find((t, i) => (code as any)._tokenLoc[i].line === line && t.text === text);
  assert.ok((tokAt(0, "bar").opacity ?? 1) > 0.9, "word(0,4,3) selects 'bar'");
  assert.ok((tokAt(0, "foo").opacity ?? 1) < 0.3, "'foo' dims");
  assert.ok((tokAt(1, "baz").opacity ?? 1) > 0.9, "lines(1) selects 'baz'");
});

test("findFirstRange locates strings and regexes in line/col space", () => {
  const code = new Code("const a = 1;\nreturn a + 2;", { lineNumbers: false });
  const r = code.findFirstRange("return")!;
  assert.deepEqual(r, { startLine: 1, startCol: 0, endLine: 1, endCol: 6 });
  const rx = code.findFirstRange(/\d+/)!;
  assert.equal(rx.startLine, 0);
  assert.equal(rx.startCol, 10, "first number literal");
  assert.equal(code.findFirstRange("missing"), null);
});

// --- instant mutators -------------------------------------------------------

test("setCode rebuilds in place, preserving identity and top-left anchor", () => {
  const code = new Code("short", { lineNumbers: false });
  code.moveTo([1, -1, 0]);
  const ul = code.getCorner([-1, 1, 0]);
  const before = code.codeTokens.submobjects.length;
  const same = code.setCode("a much longer line\nand a second");
  assert.equal(same, code, "chainable, same object");
  assert.equal(code.codeString, "a much longer line\nand a second");
  assert.ok(code.codeTokens.submobjects.length > before, "tokens rebuilt");
  const ul2 = code.getCorner([-1, 1, 0]);
  close(ul[0], ul2[0], 1e-6, "left anchor kept");
  close(ul[1], ul2[1], 1e-6, "top anchor kept");
});

test("replace(range, text) / prepend / append mutate the source instantly", () => {
  const code = new Code("aaa\nbbb\nccc", { lineNumbers: false });
  code.replace(lines(1), "BBB");
  assert.equal(code.codeString, "aaa\nBBB\nccc");
  code.replace(word(0, 0, 1), "X");
  assert.equal(code.codeString, "Xaa\nBBB\nccc");
  code.prepend("// header\n");
  assert.ok(code.codeString.startsWith("// header\n"));
  code.append("\n// footer");
  assert.ok(code.codeString.endsWith("\n// footer"));
});

test("Code.replace still accepts a Mobject (manim replace-in-space dispatch)", () => {
  const a = new Code("aa", { lineNumbers: false });
  const b = new Code("bb", { lineNumbers: false });
  b.moveTo([3, 3, 0]);
  a.replace(b);
  close(a.getCenter()[0], 3, 1e-6, "moved onto the other mobject");
  close(a.getCenter()[1], 3, 1e-6);
});

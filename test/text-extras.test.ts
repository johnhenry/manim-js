import { test, before } from "node:test";
import assert from "node:assert/strict";

import { Paragraph } from "../src/mobject/text/paragraph.ts";
import { BulletedList, Title } from "../src/mobject/text/tex_extras.ts";
import { Code } from "../src/mobject/text/code.ts";
import { Variable } from "../src/mobject/text/variable.ts";
import { DecimalNumber } from "../src/mobject/value_tracker.ts";
import { ChangeDecimalToValue, ChangingDecimal } from "../src/animation/numbers.ts";

before(async () => {
  const { loadVectorFont } = await import("../src/renderer/fonts-node.ts");
  await loadVectorFont();
  const { initMathTex } = await import("../src/mobject/mathtex.ts");
  await initMathTex();
});

test("Paragraph exposes one line mobject per line", () => {
  const p = new Paragraph("alpha", "beta", "gamma", { alignment: "left" });
  assert.equal(p.lines.submobjects.length, 3);
});

test("BulletedList has one bullet per item and fadeAllBut dims others", () => {
  const bl = new BulletedList("First item", "Second item");
  assert.equal(bl.items.submobjects.length, 2);
  // Each row's first submobject is the bullet Dot.
  assert.ok(bl.getBullet(0));
  assert.ok(bl.getBullet(1));

  bl.fadeAllBut(0, 0.25);
  const focused = bl.items.submobjects[0].getFamily();
  const dimmed = bl.items.submobjects[1].getFamily();
  assert.ok(focused.every((m: any) => (m.fillOpacity ?? 1) >= 0.99 || (m.opacity ?? 1) >= 0.99));
  assert.ok(dimmed.some((m: any) => (m.opacity ?? 1) <= 0.5));
});

test("Title has an underline submobject", () => {
  const t = new Title("My Title");
  assert.ok(t.underline);
  assert.ok(t.submobjects.includes(t.underline as any));
});

test("Title without underline has none", () => {
  const t = new Title("Bare", { includeUnderline: false });
  assert.equal(t.underline, null);
});

test("Code highlights tokens with more than one distinct color and has line numbers", () => {
  const src = 'const x = 42;\n// a comment\nreturn "hello";';
  const code = new Code(src, { language: "js", lineNumbers: true });
  const colors = new Set(code.codeTokens.submobjects.map((m: any) => m.fillColor.toHex()));
  assert.ok(colors.size > 1, `expected >1 distinct token colors, got ${colors.size}`);
  assert.equal(code.lineNumbers.submobjects.length, 3);
  assert.ok(code.background);
  assert.equal(code.codeLines.submobjects.length, 3);
});

test("Code window background variant builds", () => {
  const code = new Code("print(1)", { language: "python", background: "window" });
  assert.ok(code.background);
});

test("Variable tracker.setValue updates the displayed number", () => {
  const v = new Variable(0, "x", { numDecimalPlaces: 0 });
  v.tracker.setValue(5);
  v.update(0); // run updaters
  assert.equal(v.value.getValue(), 5);
  assert.ok(v.value.text.includes("5"));
});

test("ChangeDecimalToValue drives a DecimalNumber from 0 to 10", () => {
  const d = new DecimalNumber(0, { numDecimalPlaces: 2 });
  const anim = new ChangeDecimalToValue(d, 10);
  anim.begin();
  anim.interpolate(1);
  anim.finish();
  assert.ok(Math.abs(d.getValue() - 10) < 1e-6, `expected ~10, got ${d.getValue()}`);
});

test("ChangingDecimal sets value via update function", () => {
  const d = new DecimalNumber(0, { numDecimalPlaces: 1 });
  const anim = new ChangingDecimal(d, (a) => a * 3);
  anim.begin();
  anim.interpolate(1);
  assert.ok(Math.abs(d.getValue() - 3) < 1e-6);
});

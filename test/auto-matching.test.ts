import { test } from "node:test";
import assert from "node:assert/strict";
import { TransformMatchingAuto, autoMatchKeys } from "../src/animation/auto_matching.ts";
import { VGroup } from "../src/mobject/VMobject.ts";
import { Circle, Square, Triangle } from "../src/mobject/geometry.ts";

function tagged(mob: any, id: string) { (mob as any).matchId = id; return mob; }
function animNames(group: any) { return group.animations.map((a: any) => a.constructor.name); }

test("pairs by matchId across states (moved element still matches → Transform)", () => {
  const a = new VGroup();
  a.add(tagged(new Circle().moveTo([-3, 0, 0]), "hero"));
  a.add(tagged(new Square().moveTo([3, 0, 0]), "onlyA"));

  const b = new VGroup();
  b.add(tagged(new Circle().moveTo([3, 2, 0]), "hero")); // moved, but same matchId
  b.add(tagged(new Triangle().moveTo([0, 0, 0]), "onlyB"));

  const tm: any = new TransformMatchingAuto(a, b);
  const names = animNames(tm);
  // hero↔hero -> Transform ; onlyA -> FadeOut ; onlyB -> FadeIn
  assert.equal(names.filter((n: string) => n === "Transform").length, 1);
  assert.ok(names.includes("FadeOut"));
  assert.ok(names.includes("FadeIn"));
});

test("without matchId, matches by text then shape signature", () => {
  const a = new VGroup(); a.add(new Circle()); a.add(new Circle());
  const b = new VGroup(); b.add(new Circle());
  const tm: any = new TransformMatchingAuto(a, b);
  const names = animNames(tm);
  // Two identical circles vs one: one Transform + one FadeOut.
  assert.equal(names.filter((n: string) => n === "Transform").length, 1);
  assert.equal(names.filter((n: string) => n === "FadeOut").length, 1);
});

test("autoMatchKeys uses matchId when present", () => {
  const g = new VGroup();
  g.add(tagged(new Circle(), "x"));
  g.add(new Square());
  const keys = autoMatchKeys(g);
  assert.equal(keys[0], "id:x");
  assert.match(keys[1], /^shape:/);
});

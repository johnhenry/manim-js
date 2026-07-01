import { test, before } from "node:test";
import assert from "node:assert/strict";
import { MathTex } from "../src/mobject/mathtex.ts";
import { Square } from "../src/mobject/geometry.ts";
import {
  TransformMatchingTex,
  TransformMatchingShapes,
  matchingParts,
} from "../src/animation/transform_matching.ts";
import { AnimationGroup } from "../src/animation/composition.ts";

before(async () => {
  const { initMathTex } = await import("../src/mobject/mathtex.ts");
  await initMathTex();
});

// Count sub-animations by their concrete constructor name.
function counts(group: AnimationGroup) {
  const c: Record<string, number> = {};
  for (const a of (group as any).animations) {
    const n = (a as any).constructor.name;
    c[n] = (c[n] || 0) + 1;
  }
  return c;
}

test("TransformMatchingTex matches shared tex parts and fades the rest", () => {
  const src = new MathTex("a^2", "+", "b^2");
  const tgt = new MathTex("a^2", "+", "c^2");
  const anim = new TransformMatchingTex(src, tgt);

  assert.ok(anim instanceof AnimationGroup, "is an AnimationGroup");
  assert.ok(anim.introducer && anim.remover, "introducer + remover");

  const c = counts(anim);
  // "a^2" and "+" are shared -> two Transforms.
  assert.strictEqual(c.Transform, 2, "a^2 and + are Transform-matched");
  // "b^2" is source-only -> FadeOut; "c^2" is target-only -> FadeIn.
  assert.strictEqual(c.FadeOut, 1, "b^2 fades out");
  assert.strictEqual(c.FadeIn, 1, "c^2 fades in");
});

test("keyMap forces a mapping between differently-written parts", () => {
  const src = new MathTex("a^2", "+", "b^2");
  const tgt = new MathTex("a^2", "+", "c^2");
  // Force the leftover a-part to map onto c^2 (contrived, exercises override).
  const anim = new TransformMatchingTex(src, tgt, { keyMap: { "b^2": "c^2" } });

  const c = counts(anim);
  // a^2, +, and b^2->c^2 all Transform now; nothing left to fade.
  assert.strictEqual(c.Transform, 3, "keyMap adds the forced pair");
  assert.strictEqual(c.FadeOut ?? 0, 0, "no leftover source");
  assert.strictEqual(c.FadeIn ?? 0, 0, "no leftover target");
});

test("keyMap { a^2 -> c^2 } forces that specific pair", () => {
  const src = new MathTex("a^2", "+", "b^2");
  const tgt = new MathTex("a^2", "+", "c^2");
  const anim = new TransformMatchingTex(src, tgt, { keyMap: { "a^2": "c^2" } });

  // Now source a^2 targets c^2 (not the identical a^2 in target), + matches,
  // source b^2 has no target (c^2 consumed) -> FadeOut; target a^2 -> FadeIn.
  const c = counts(anim);
  assert.strictEqual(c.Transform, 2, "a^2->c^2 and + are transformed");
  assert.strictEqual(c.FadeOut, 1, "b^2 fades out");
  assert.strictEqual(c.FadeIn, 1, "unmatched target a^2 fades in");
});

test("transformMismatches transforms leftovers by position instead of fading", () => {
  const src = new MathTex("a^2", "+", "b^2");
  const tgt = new MathTex("a^2", "+", "c^2");
  const anim = new TransformMatchingTex(src, tgt, { transformMismatches: true });

  const c = counts(anim);
  // a^2 + matched (2), plus leftover b^2->c^2 transformed by position (1).
  assert.strictEqual(c.Transform, 3);
  assert.strictEqual(c.FadeOut ?? 0, 0);
  assert.strictEqual(c.FadeIn ?? 0, 0);
});

test("matchingParts returns a map keyed by tex", () => {
  const m = new MathTex("a^2", "+", "b^2");
  const map = matchingParts(m);
  assert.ok(map instanceof Map);
  assert.ok(map.has("a^2"), "keyed by a^2");
  assert.ok(map.has("+"), "keyed by +");
  assert.ok(map.has("b^2"), "keyed by b^2");
  // Values are the actual part VGroups from the MathTex.
  assert.ok(m.parts.includes(map.get("a^2")));
});

test("TransformMatchingShapes of two squares still builds", () => {
  const anim = new TransformMatchingShapes(new Square(), new Square());
  assert.ok(anim instanceof AnimationGroup);
  assert.ok(anim.introducer && anim.remover);
  assert.ok((anim as any).animations.length > 0, "has sub-animations");
});

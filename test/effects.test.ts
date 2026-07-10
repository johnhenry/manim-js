import { test } from "node:test";
import assert from "node:assert/strict";
import {
  effectsToCanvasFilter, effectPad, effectsFingerprint, splitEffects,
  makeNoiseBytes, saturateMatrix, hueRotateMatrix, lerpEffects,
} from "../src/core/effects.ts";
import type { Effect } from "../src/core/effects.ts";
import { Circle } from "../src/mobject/geometry.ts";

test("effectsToCanvasFilter builds exact CSS filter strings and scales blur radii", () => {
  assert.equal(effectsToCanvasFilter([{ type: "blur", radius: 4 }], 1), "blur(4px)");
  assert.equal(effectsToCanvasFilter([{ type: "blur", radius: 4 }], 2), "blur(8px)");
  assert.equal(
    effectsToCanvasFilter([{ type: "colorAdjust", saturate: 1.2, hueRotate: 30 }], 1),
    "saturate(1.2) hue-rotate(30deg)",
  );
  assert.equal(
    effectsToCanvasFilter(
      [{ type: "blur", radius: 2 }, { type: "colorAdjust", brightness: 0.8, contrast: 1.1 }], 1),
    "blur(2px) brightness(0.8) contrast(1.1)",
  );
});

test("effectsToCanvasFilter elides identity values and non-filter effects", () => {
  assert.equal(effectsToCanvasFilter([], 1), "");
  assert.equal(
    effectsToCanvasFilter([{ type: "colorAdjust", brightness: 1, contrast: 1, saturate: 1, hueRotate: 0 }], 1),
    "",
  );
  // shadow/glow/noise are separate passes, never in the filter string.
  assert.equal(
    effectsToCanvasFilter([
      { type: "shadow", blur: 8 }, { type: "glow", radius: 6 }, { type: "noise", amount: 0.5 },
    ], 1),
    "",
  );
});

test("effectPad grows with radius, covers shadow offset, and is 0 for colorAdjust-only", () => {
  const p4 = effectPad([{ type: "blur", radius: 4 }], 1);
  const p8 = effectPad([{ type: "blur", radius: 8 }], 1);
  assert.ok(p8 > p4 && p4 > 0);
  assert.equal(effectPad([{ type: "colorAdjust", saturate: 2 }], 1), 0);
  const noOffset = effectPad([{ type: "shadow", blur: 4 }], 1);
  const withOffset = effectPad([{ type: "shadow", blur: 4, offsetX: 20 }], 1);
  assert.ok(withOffset > noOffset, "shadow offset must expand the pad");
  // Scale multiplies through.
  assert.ok(effectPad([{ type: "blur", radius: 4 }], 2) >= 2 * p4 - 1);
});

test("makeNoiseBytes is byte-identical per (size, seed, mono) and differs across seeds", () => {
  const a = makeNoiseBytes(64, 42, true);
  const b = makeNoiseBytes(64, 42, true);
  assert.deepEqual(Array.from(a.slice(0, 64)), Array.from(b.slice(0, 64)));
  assert.equal(Buffer.from(a).equals(Buffer.from(b)), true);
  const c = makeNoiseBytes(64, 43, true);
  assert.equal(Buffer.from(a).equals(Buffer.from(c)), false);
  // Monochrome: R === G === B per pixel; alpha always 255.
  for (let i = 0; i < 16; i++) {
    const o = i * 4;
    assert.equal(a[o], a[o + 1]);
    assert.equal(a[o + 1], a[o + 2]);
    assert.equal(a[o + 3], 255);
  }
});

test("splitEffects plans passes and preserves filter order", () => {
  const effects: Effect[] = [
    { type: "colorAdjust", saturate: 2 },
    { type: "glow", radius: 6 },
    { type: "blur", radius: 3 },
    { type: "shadow", blur: 5 },
    { type: "noise", amount: 0.2 },
  ];
  const plan = splitEffects(effects);
  assert.deepEqual(plan.filter.map((e) => e.type), ["colorAdjust", "blur"]);
  assert.equal(plan.glow?.radius, 6);
  assert.equal(plan.shadow?.blur, 5);
  assert.equal(plan.noise?.amount, 0.2);
});

test("effectsFingerprint is stable and distinguishes different stacks", () => {
  assert.equal(effectsFingerprint(undefined), "");
  assert.equal(effectsFingerprint([]), "");
  const fp1 = effectsFingerprint([{ type: "blur", radius: 4 }]);
  const fp2 = effectsFingerprint([{ type: "blur", radius: 4 }]);
  const fp3 = effectsFingerprint([{ type: "blur", radius: 5 }]);
  assert.equal(fp1, fp2);
  assert.notEqual(fp1, fp3);
});

test("saturate/hueRotate matrices are identity at their identity inputs", () => {
  const idSat = saturateMatrix(1);
  const idHue = hueRotateMatrix(0);
  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  for (let i = 0; i < 20; i++) {
    assert.ok(Math.abs(idSat[i] - identity[i]) < 1e-9, `saturate[ ${i} ]`);
    assert.ok(Math.abs(idHue[i] - identity[i]) < 1e-9, `hueRotate[ ${i} ]`);
  }
  // saturate(0) removes chroma: each output row is the same luminance triple.
  const gray = saturateMatrix(0);
  assert.ok(Math.abs(gray[0] - 0.213) < 1e-9);
  assert.ok(Math.abs(gray[1] - 0.715) < 1e-9);
  assert.ok(Math.abs(gray[2] - 0.072) < 1e-9);
});

test("fluent API chains, appends, and clears", () => {
  const c = new Circle({ radius: 1 });
  c.blur(4).glow(8, "#ff0000").dropShadow({ blur: 6, offsetY: 2 }).colorAdjust({ saturate: 1.5 }).noise(0.3);
  assert.equal(c.effects?.length, 5);
  assert.deepEqual(c.effects?.map((e) => e.type), ["blur", "glow", "shadow", "colorAdjust", "noise"]);
  c.clearEffects();
  assert.equal(c.effects, undefined);
});

test("copy() deep-clones effects (mutating the copy leaves the original intact)", () => {
  const c = new Circle({ radius: 1 }).blur(4);
  const clone = c.copy();
  (clone.effects![0] as { type: "blur"; radius: number }).radius = 99;
  assert.equal((c.effects![0] as { type: "blur"; radius: number }).radius, 4);
});

test("lerpEffects blends same-shape stacks numerically", () => {
  const start: Effect[] = [{ type: "blur", radius: 0 }, { type: "colorAdjust", saturate: 1 }];
  const target: Effect[] = [{ type: "blur", radius: 10 }, { type: "colorAdjust", saturate: 3 }];
  const mid = lerpEffects(start, target, 0.5)!;
  assert.equal((mid[0] as any).radius, 5);
  assert.equal((mid[1] as any).saturate, 2);
});

test("lerpEffects snaps mixed-shape stacks (start below 1, target at 1)", () => {
  const start: Effect[] = [{ type: "blur", radius: 4 }];
  const target: Effect[] = [{ type: "glow", radius: 8 }];
  assert.equal(lerpEffects(start, target, 0.5)![0].type, "blur");
  assert.equal(lerpEffects(start, target, 1)![0].type, "glow");
});

test("Mobject.interpolate carries effects through a Transform-style blend", () => {
  const start = new Circle({ radius: 1 }).blur(0);
  const target = new Circle({ radius: 1 }).blur(10);
  const live = new Circle({ radius: 1 });
  live.interpolate(start, target, 0.3);
  assert.ok(Math.abs((live.effects![0] as any).radius - 3) < 1e-9);
});

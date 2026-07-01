import { test, before } from "node:test";
import assert from "node:assert";
import { initMathTex, texToSVG, MathTex } from "../src/mobject/mathtex.ts";
import { mathTexImage, MathTexImage } from "../src/mobject/mathtex_image.ts";
import {
  texToSVGViaDvisvgm,
  detectDvisvgmToolchain,
  mathTexDvisvgmOrFallback,
} from "../src/mobject/mathtex_dvisvgm.ts";

before(async () => {
  await initMathTex();
});

test("texToSVG returns a raw MathJax SVG string", async () => {
  const svg = await texToSVG("x^2");
  assert.equal(typeof svg, "string");
  assert.ok(svg.includes("<svg"), "output contains an <svg element");
});

test("mathTexImage builds an ImageMobject with a bitmap and a finite box", async () => {
  const im = await mathTexImage("x^2", { fontSize: 1 });
  assert.ok(im instanceof MathTexImage);
  assert.ok(im._isImage, "is an image mobject");
  assert.ok(im.image, "carries a loaded bitmap");
  assert.ok(Number.isFinite(im.getHeight()) && im.getHeight() > 0, "finite positive height");
  assert.ok(Number.isFinite(im.getWidth()) && im.getWidth() > 0, "finite positive width");
  for (const p of im.points) assert.ok(p.every(Number.isFinite), "box corners are finite");
});

test("texToSVGViaDvisvgm throws a clear error when the toolchain is absent", async () => {
  const tc = await detectDvisvgmToolchain();
  if (tc.available) {
    // Toolchain present (unusual for CI): it should produce an SVG instead.
    const svg = await texToSVGViaDvisvgm("x^2");
    assert.ok(svg.includes("<svg"), "dvisvgm produced an SVG");
    return;
  }
  await assert.rejects(
    () => texToSVGViaDvisvgm("x^2"),
    (err: Error) => {
      assert.ok(/TeX toolchain not found/i.test(err.message), "clear not-found message");
      assert.ok(/MathJax/i.test(err.message), "mentions MathJax fallback");
      return true;
    },
  );
});

test("mathTexDvisvgmOrFallback degrades gracefully to a MathTex", async () => {
  const mob = await mathTexDvisvgmOrFallback("x^2");
  const tc = await detectDvisvgmToolchain();
  if (!tc.available) {
    assert.ok(mob instanceof MathTex, "falls back to a normal MathTex");
    assert.ok(mob.submobjects.length > 0, "fallback carries glyphs");
  } else {
    assert.ok(mob.submobjects.length > 0, "dvisvgm path carries glyphs");
  }
});

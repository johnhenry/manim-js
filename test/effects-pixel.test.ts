// Real-pixel effects tests under @napi-rs/canvas (Skia): fake-ctx tests in
// effects-canvas.test.ts prove the PASS STRUCTURE; these prove Skia actually
// honors ctx.filter/shadow* the way the pipeline assumes. Assertions are on
// pixel PROPERTIES (edge softness, energy location, byte determinism) --
// never golden bytes -- so browser/Skia kernel differences can't flake them.

import { test } from "node:test";
import assert from "node:assert/strict";

import { CanvasRenderer, Camera } from "../src/renderer/CanvasRenderer.ts";
import { Square, Circle } from "../src/mobject/geometry.ts";
import { loadNapiCanvas } from "./_snapshot_util.ts";

const canvasMod = await loadNapiCanvas();
const canvasAvailable = !!canvasMod;

const W = 160, H = 160;

function renderFrame(mobjects: any[]): Uint8ClampedArray {
  const { createCanvas } = canvasMod;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const camera = new Camera({ pixelWidth: W, pixelHeight: H, frameHeight: 8, background: "#000000" });
  const renderer = new CanvasRenderer(ctx as any, camera, { createCanvas: (w, h) => createCanvas(w, h) });
  renderer.renderScene(mobjects);
  return ctx.getImageData(0, 0, W, H).data;
}

// Count pixels whose red channel is neither near-black nor near-full --
// i.e. genuinely intermediate values, the signature of a soft edge.
function intermediateCount(data: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 24 && data[i] < 224) n++;
  }
  return n;
}

test("blur genuinely softens a hard edge (Skia honors ctx.filter)", { skip: !canvasAvailable && "@napi-rs/canvas not available" }, () => {
  const sharp = renderFrame([new Square({ sideLength: 2, fillColor: "#ff0000", fillOpacity: 1, strokeWidth: 0 })]);
  const blurred = renderFrame([new Square({ sideLength: 2, fillColor: "#ff0000", fillOpacity: 1, strokeWidth: 0 }).blur(8)]);
  const sharpSoft = intermediateCount(sharp);
  const blurredSoft = intermediateCount(blurred);
  assert.ok(
    blurredSoft > Math.max(50, sharpSoft * 5),
    `blur must multiply soft-edge pixels: sharp=${sharpSoft}, blurred=${blurredSoft}`,
  );
});

test("glow puts color energy strictly outside the unfiltered shape's bbox", { skip: !canvasAvailable && "@napi-rs/canvas not available" }, () => {
  // A small centered square: its unfiltered bbox in pixels is easy to bound.
  // Glow radius is declared in 1080p-reference px and scaled by
  // strokeScale() = 160/1080 ~ 0.148 here, so glow(60) ~ a 9px halo.
  const side = 1; // world units; frameHeight 8 over 160px -> 20px/unit -> 20px square
  const plain = renderFrame([new Square({ sideLength: side, fillColor: "#00ff00", fillOpacity: 1, strokeWidth: 0 })]);
  const glowing = renderFrame([new Square({ sideLength: side, fillColor: "#00ff00", fillOpacity: 1, strokeWidth: 0 }).glow(60, "#00ff00", 3)]);
  // Probe just outside the square's 10px half-side (14px from center):
  // plain render must be black there, glowing render must have green energy.
  const cx = W / 2, cy = H / 2;
  const probes: Array<[number, number]> = [
    [cx + 14, cy], [cx - 14, cy], [cx, cy + 14], [cx, cy - 14],
  ];
  let plainEnergy = 0, glowEnergy = 0;
  for (const [x, y] of probes) {
    const o = (Math.round(y) * W + Math.round(x)) * 4;
    plainEnergy += plain[o + 1];
    glowEnergy += glowing[o + 1];
  }
  assert.ok(plainEnergy < 8, `unfiltered square must be black at the probe ring (got ${plainEnergy})`);
  assert.ok(glowEnergy > 40, `glow must land energy outside the bbox (got ${glowEnergy})`);
});

test("colorAdjust saturate(0) drains chroma", { skip: !canvasAvailable && "@napi-rs/canvas not available" }, () => {
  const colored = renderFrame([new Circle({ radius: 1.5, fillColor: "#ff0000", fillOpacity: 1, strokeWidth: 0 })]);
  const gray = renderFrame([new Circle({ radius: 1.5, fillColor: "#ff0000", fillOpacity: 1, strokeWidth: 0 }).colorAdjust({ saturate: 0 })]);
  const center = ((H / 2) * W + W / 2) * 4;
  // Red circle: R >> G. Desaturated: R ~= G ~= B.
  assert.ok(colored[center] - colored[center + 1] > 100, "plain render is saturated red");
  assert.ok(Math.abs(gray[center] - gray[center + 1]) < 12, "saturate(0) renders gray");
  assert.ok(Math.abs(gray[center + 1] - gray[center + 2]) < 12);
});

test("seeded noise renders byte-identical across runs (render-cache safety)", { skip: !canvasAvailable && "@napi-rs/canvas not available" }, () => {
  const scene = () => [new Circle({ radius: 1.5, fillColor: "#4488ff", fillOpacity: 1, strokeWidth: 0 }).noise(0.4, { seed: 42 })];
  const a = renderFrame(scene());
  const b = renderFrame(scene());
  assert.ok(Buffer.from(a).equals(Buffer.from(b)), "noise effect must be deterministic");
  // And the noise is actually visible: variance inside the circle rises.
  const plain = renderFrame([new Circle({ radius: 1.5, fillColor: "#4488ff", fillOpacity: 1, strokeWidth: 0 })]);
  const varOf = (data: Uint8ClampedArray) => {
    let sum = 0, sumSq = 0, n = 0;
    const cx = W / 2, cy = H / 2;
    for (let dy = -10; dy <= 10; dy += 2) {
      for (let dx = -10; dx <= 10; dx += 2) {
        const o = ((cy + dy) * W + cx + dx) * 4;
        sum += data[o]; sumSq += data[o] * data[o]; n++;
      }
    }
    const mean = sum / n;
    return sumSq / n - mean * mean;
  };
  assert.ok(varOf(a) > varOf(plain) + 4, `noise must add pixel variance (plain=${varOf(plain)}, noisy=${varOf(a)})`);
});

test("noise stays clipped to the shape's alpha (background remains untouched)", { skip: !canvasAvailable && "@napi-rs/canvas not available" }, () => {
  const noisy = renderFrame([new Circle({ radius: 1, fillColor: "#ffffff", fillOpacity: 1, strokeWidth: 0 }).noise(0.8, { seed: 7 })]);
  // Probe far corners: must still be pure background black.
  for (const [x, y] of [[6, 6], [W - 7, 6], [6, H - 7], [W - 7, H - 7]] as Array<[number, number]>) {
    const o = (y * W + x) * 4;
    assert.ok(noisy[o] + noisy[o + 1] + noisy[o + 2] < 12, `corner (${x},${y}) must stay background`);
  }
});

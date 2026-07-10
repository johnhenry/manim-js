// Shared harness for the Motion Canvas parity ports: every demo is a
// line-for-line port of a Motion Canvas docs/examples scene (original .tsx
// alongside in ./ref/). demoRender() keeps rendering uniform.
//
//   ECMANIM_DEMO_QUALITY=low|medium|high   (default medium)
//
// Porting conventions (see README.md for the full map):
// - MC scenes are 1920x1080 PIXEL space, center origin, y-DOWN. ecmanim's
//   world is 8 units tall, y-UP. `px(x, y)` / `pxLen(n)` convert: divide by
//   135 (= 1080/8) and negate y. MC `lineWidth` maps to `strokeWidth`
//   unchanged (both are ~pixels at 1080p).
// - JSX `<Circle x width fill/>` becomes constructors; generators + yield*
//   become async construct() + scene.play(...).
// - `node().prop(v, dur).to(v2, dur)` becomes tweenTo(node, {prop: v},
//   dur).to({prop: v2}, dur); `all(...)` becomes scene.play(a, b, ...).

import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { render, initMathTex } from "../../src/node.ts";
import type { RenderOptions } from "../../src/node.ts";

export const DEMO_QUALITY = process.env.ECMANIM_DEMO_QUALITY ?? "medium";

/** Pixels-per-world-unit at MC's 1080p reference. */
export const PPU = 135;

/** MC pixel coords (center origin, y-down) -> ecmanim world (y-up). */
export function px(x: number, y = 0): number[] {
  return [x / PPU, -y / PPU, 0];
}

/** An MC pixel LENGTH (width/height/radius/fontSize) in world units. */
export function pxLen(n: number): number {
  return n / PPU;
}

export function demoOut(metaUrl: string, suffix = ""): string {
  const name = basename(fileURLToPath(metaUrl)).replace(/\.ts$/, "");
  return new URL(`./out/${name}${suffix}.mp4`, import.meta.url).pathname;
}

export async function demoRender(
  sceneOrConstruct: any,
  metaUrl: string,
  options: RenderOptions & { mathTex?: boolean } = {},
): Promise<void> {
  const { mathTex, ...renderOptions } = options;
  if (mathTex) await initMathTex();
  const output = renderOptions.output ?? demoOut(metaUrl);
  const t0 = Date.now();
  await render(sceneOrConstruct, {
    quality: DEMO_QUALITY,
    verbose: false,
    // Motion Canvas's default background.
    background: "#141414",
    ...renderOptions,
    output,
  });
  console.log(`✓ ${basename(output)} (${((Date.now() - t0) / 1000).toFixed(1)}s @ ${(renderOptions as any).quality ?? DEMO_QUALITY})`);
}

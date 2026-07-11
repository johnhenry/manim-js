// Shared harness for the p5.js generative demos: each demo recreates one
// p5.js gallery sketch (raw source in ./ref/) on ecmanim's simulation/noise/
// L-system primitives. Deliberately does NOT override `background` — same
// convention as the GSAP campaign: render()'s default is black (#000000,
// src/node.ts) and Text defaults to WHITE, sidestepping the invisible-text-
// on-white-background bug class the ECharts campaign hit repeatedly.
//
//   ECMANIM_DEMO_QUALITY=low|medium|high   (default medium)

import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../../src/node.ts";
import type { RenderOptions } from "../../src/node.ts";

export const DEMO_QUALITY = process.env.ECMANIM_DEMO_QUALITY ?? "medium";

export function demoOut(metaUrl: string, suffix = ""): string {
  const name = basename(fileURLToPath(metaUrl)).replace(/\.ts$/, "");
  return new URL(`./out/${name}${suffix}.mp4`, import.meta.url).pathname;
}

export async function demoRender(
  sceneOrConstruct: any,
  metaUrl: string,
  options: RenderOptions = {},
): Promise<void> {
  const output = options.output ?? demoOut(metaUrl);
  const t0 = Date.now();
  await render(sceneOrConstruct, {
    quality: DEMO_QUALITY,
    verbose: false,
    ...options,
    output,
  });
  console.log(`✓ ${basename(output)} (${((Date.now() - t0) / 1000).toFixed(1)}s @ ${(options as any).quality ?? DEMO_QUALITY})`);
}

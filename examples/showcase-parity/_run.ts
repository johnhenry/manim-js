// Shared harness for the showcase-parity demos: one demoRender() so every
// demo renders the same way (quality/env overrides, timing, output naming).
//
//   ECMANIM_DEMO_QUALITY=low    render fast (CI smoke uses this)
//   ECMANIM_DEMO_SKIP_GL=1      skip renderGL-dependent demos (no Chrome)
//   ECMANIM_TTS=openai          upgrade TTS demos from the silent provider

import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "../../src/node.ts";
import type { RenderOptions } from "../../src/node.ts";

export const DEMO_QUALITY = process.env.ECMANIM_DEMO_QUALITY ?? "medium";
export const SKIP_GL = process.env.ECMANIM_DEMO_SKIP_GL === "1";

/** Output path for a demo module: out/<its-own-basename>.mp4 */
export function demoOut(metaUrl: string, suffix = ""): string {
  const name = basename(fileURLToPath(metaUrl)).replace(/\.ts$/, "");
  return new URL(`./out/${name}${suffix}.mp4`, import.meta.url).pathname;
}

export async function demoRender(
  sceneOrConstruct: any,
  metaUrl: string,
  options: RenderOptions & { suffix?: string } = {},
): Promise<void> {
  const { suffix = "", ...rest } = options;
  const output = rest.output ?? demoOut(metaUrl, suffix);
  const t0 = Date.now();
  await render(sceneOrConstruct, {
    quality: DEMO_QUALITY,
    verbose: false,
    ...rest,
    output,
  });
  console.log(`✓ ${basename(output)} (${((Date.now() - t0) / 1000).toFixed(1)}s @ ${rest.quality ?? DEMO_QUALITY})`);
}

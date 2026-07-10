// Shared harness for the Mermaid parity ports: each demo loads a diagram
// from the corpus type's canonical syntax-doc example (ref/*.md, MIT),
// animates it (staged reveal / highlight / diff), and renders to video.
//
//   ECMANIM_DEMO_QUALITY=low|medium|high   (default medium)
//
// loadMermaid renders headlessly via mermaid+jsdom (devDependencies) —
// no browser, no GPU. Diagram elements are addressable by friendly ids
// (see src/loaders/mermaid_loader.ts docstrings for per-type conventions).

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
    // Mermaid's default theme draws on white.
    background: "#ffffff",
    ...options,
    output,
  });
  console.log(`✓ ${basename(output)} (${((Date.now() - t0) / 1000).toFixed(1)}s @ ${(options as any).quality ?? DEMO_QUALITY})`);
}

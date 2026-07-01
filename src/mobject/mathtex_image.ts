// LaTeX math rendered as a RASTER bitmap instead of per-glyph Bezier outlines.
//
// MathTex (mathtex.ts) turns TeX into a VGroup of glyph VMobjects so Write can
// trace strokes and Transform can morph the math. That is expensive for dense
// equations you never animate. When you only need to *place* an equation in the
// scene (a static label, a busy formula, a reference sheet), rasterizing the
// MathJax SVG once and drawing it as an ImageMobject is far cheaper.
//
//   NOTE: a MathTexImage is a RASTER, not a vector. It cannot be Write-traced or
//   Transform-morphed at the glyph level. Use MathTex for animatable math and
//   MathTexImage for static, performance-sensitive math.
//
// Pipeline: texToSVG(tex) -> data:image/svg+xml;base64 URL -> loadImage() ->
// ImageMobject bitmap. In Node the bitmap loads via @napi-rs/canvas's
// loadImage (it accepts SVG data URLs); in the browser via an HTMLImageElement.

import { ImageMobject } from "./image_mobject.ts";
import type { ImageMobjectConfig } from "./image_mobject.ts";
import { texToSVG } from "./mathtex.ts";
import type { MathTexConfig } from "./mathtex.ts";

export interface MathTexImageConfig extends MathTexConfig, ImageMobjectConfig {
  /** Height of the placed image in scene units. Defaults from fontSize. */
  height?: number;
  width?: number;
}

// Base64-encode a UTF-8 string in either Node (Buffer) or the browser (btoa).
function toBase64(str: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(str, "utf-8").toString("base64");
  // Browser: btoa needs latin1; encode UTF-8 bytes first.
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return (globalThis as any).btoa(binary);
}

// Build a data URL for an SVG string (base64 avoids URL-encoding pitfalls).
function svgToDataUrl(svg: string): string {
  return "data:image/svg+xml;base64," + toBase64(svg);
}

// Load an SVG data URL into a drawable bitmap. Node: @napi-rs/canvas loadImage
// accepts SVG data URLs / buffers. Browser: HTMLImageElement.
async function loadBitmap(dataUrl: string): Promise<any> {
  if (typeof document !== "undefined") {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load rasterized MathTex SVG image."));
      img.src = dataUrl;
    });
  }
  // Node: reuse @napi-rs/canvas (same dependency ImageMobject bitmaps use).
  const canvas: any = await import("@napi-rs/canvas");
  return await canvas.loadImage(dataUrl);
}

// Turn a config's fontSize into a placed image height (scene units). MathTex's
// default fontSize is 0.7 (height in world units); mirror that here so a
// MathTexImage lands at roughly the same size as the vector MathTex.
function heightFromConfig(config: MathTexImageConfig): number | undefined {
  if (config.height != null) return config.height;
  if (config.width != null) return undefined; // width drives sizing instead
  const fs = config.fontSize;
  return fs != null ? fs : 0.7;
}

/**
 * A rasterized LaTeX equation, drawable as an ImageMobject. NOT morphable — it
 * is a bitmap, chosen for cheap placement of dense/static equations.
 *
 * Construct it via the async factory `mathTexImage(tex, config)` (below), which
 * performs the async SVG render + bitmap load, mirroring node.ts's
 * `imageMobject`. The class itself is exported for typing/instanceof and to
 * allow post-hoc bitmap assignment.
 */
export class MathTexImage extends ImageMobject {
  /** The tex source this image was rendered from. */
  tex: string;
  /** True — this is a raster equation and cannot be animated per glyph. */
  readonly isRaster = true;

  constructor(image: any, tex: string, config: MathTexImageConfig = {}) {
    super(image, config);
    this.tex = String(tex);
  }
}

/**
 * Async factory: render `tex` to a MathJax SVG, rasterize it to a bitmap, and
 * wrap it in a MathTexImage sized by `config.fontSize` / `height` / `width`.
 *
 * Mirrors node.ts's `imageMobject()` async pattern. Requires that
 * `await initMathTex()` has run (texToSVG calls it internally, so this works
 * standalone, but doing it once up front warms the MathJax font cache).
 */
export async function mathTexImage(
  tex: string,
  config: MathTexImageConfig = {},
): Promise<MathTexImage> {
  const svg = await texToSVG(tex, config);
  const dataUrl = svgToDataUrl(svg);
  const image = await loadBitmap(dataUrl);

  const height = heightFromConfig(config);
  const imgConfig: MathTexImageConfig = { ...config };
  if (height != null) imgConfig.height = height;
  return new MathTexImage(image, tex, imgConfig);
}

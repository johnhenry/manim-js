// A raster image placed in the scene. The image itself is a drawable bitmap
// (an @napi-rs/canvas Image in Node, an HTMLImageElement / ImageBitmap in the
// browser); load it with the backend's loadImage() helper and pass it in. Like
// Text, it carries a 4-corner bounding box so positioning/scaling work, and the
// renderer special-cases it (drawImage / textured quad).

import { Mobject } from "./Mobject.ts";
import type { MobjectConfig } from "./Mobject.ts";

/** Configuration accepted by ImageMobject. */
export interface ImageMobjectConfig extends MobjectConfig {
  imageWidth?: number;
  imageHeight?: number;
  /** Nearest-neighbor upscaling (default: on for bitmaps under 64px). */
  pixelated?: boolean;
  height?: number;
  width?: number;
  point?: number[];
}

export class ImageMobject extends Mobject {
  _isImage: boolean;
  image: any;
  aspect: number;
  pixelated: boolean;

  constructor(image: any, config: ImageMobjectConfig = {}) {
    super(config);
    this._isImage = true;
    this.image = image;
    const iw = image?.width ?? config.imageWidth ?? 1;
    const ih = image?.height ?? config.imageHeight ?? 1;
    // Tiny bitmaps (pixel-art / raw arrays) upscale as crisp blocks, like
    // manim. Override with `pixelated: false` for smooth interpolation.
    this.pixelated = config.pixelated ?? (iw < 64 && ih < 64);
    this.aspect = ih === 0 ? 1 : iw / ih;

    let h = config.height;
    let w = config.width;
    if (h == null && w == null) h = 2;
    if (h == null) h = (w as number) / this.aspect;
    if (w == null) w = h * this.aspect;

    // Corners: TL, TR, BR, BL (matches how the renderer reads the box).
    this.points = [
      [-w / 2, h / 2, 0],
      [w / 2, h / 2, 0],
      [w / 2, -h / 2, 0],
      [-w / 2, -h / 2, 0],
    ];
    this.opacity = config.opacity ?? 1;
    if (config.point) this.moveTo(config.point);
  }

  setImage(image: any): this {
    this.image = image;
    return this;
  }

  copy(): this {
    const c = super.copy();
    c.image = this.image; // share the bitmap
    return c;
  }
}

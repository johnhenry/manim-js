// Port of Manim CE gallery: GradientImageFromArray
// (ref/GradientImageFromArray.py) — an ImageMobject built from a raw uint8
// pixel array (imageFromArray, added in the parity pass).

import {
  Scene, ImageMobject, SurroundingRectangle, imageFromArray, GREEN,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const n = 256;
const imageArray = Array.from({ length: n }, () =>
  Array.from({ length: n }, (_, i) => (i * 256) / n),
);
const bitmap = await imageFromArray(imageArray);

class GradientImageFromArray extends Scene {
  async construct() {
    const image = new ImageMobject(bitmap, { height: 2 }).scale(2);
    (image as any).backgroundRectangle = new SurroundingRectangle(image, { color: GREEN });
    this.add(image, (image as any).backgroundRectangle);
    await this.wait(1);
  }
}

await demoRender(GradientImageFromArray, import.meta.url);

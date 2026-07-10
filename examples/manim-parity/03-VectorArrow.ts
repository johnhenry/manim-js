// Port of Manim CE gallery: VectorArrow (ref/VectorArrow.py) — a vector on a
// NumberPlane with coordinate labels.

import { Scene, Dot, Arrow, NumberPlane, Text, ORIGIN, DOWN, RIGHT } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class VectorArrow extends Scene {
  async construct() {
    const dot = new Dot({ point: ORIGIN });
    const arrow = new Arrow(ORIGIN, [2, 2, 0], { buff: 0 });
    const numberplane = new NumberPlane();
    const originText = new Text("(0, 0)").nextTo(dot, DOWN);
    const tipText = new Text("(2, 2)").nextTo(arrow.getEnd(), RIGHT);
    this.add(numberplane, dot, arrow, originText, tipText);
    await this.wait(1);
  }
}

await demoRender(VectorArrow, import.meta.url);

// Port of Manim CE gallery: MovingFrameBox (ref/MovingFrameBox.py) —
// multi-part MathTex with SurroundingRectangle hopping between parts.

import {
  Scene, MathTex, SurroundingRectangle, Write, Create, ReplacementTransform,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class MovingFrameBox extends Scene {
  async construct() {
    const text = new MathTex(
      "\\frac{d}{dx}f(x)g(x)=", "f(x)\\frac{d}{dx}g(x)", "+",
      "g(x)\\frac{d}{dx}f(x)",
    );
    await this.play(new Write(text));
    const framebox1 = new SurroundingRectangle(text.get(1), { buff: 0.1 });
    const framebox2 = new SurroundingRectangle(text.get(3), { buff: 0.1 });
    await this.play(new Create(framebox1));
    await this.wait(1);
    await this.play(new ReplacementTransform(framebox1, framebox2));
    await this.wait(1);
  }
}

await demoRender(MovingFrameBox, import.meta.url);

// Port of Manim CE gallery: BraceAnnotation (ref/BraceAnnotation.py) —
// braces with text/tex annotations, incl. a brace along the line's normal
// via getUnitVector (added in the parity pass).

import { Scene, Dot, Line, Brace, ORANGE, PI } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class BraceAnnotation extends Scene {
  async construct() {
    const dot = new Dot({ point: [-2, -1, 0] });
    const dot2 = new Dot({ point: [2, 1, 0] });
    const line = new Line(dot.getCenter(), dot2.getCenter()).setColor(ORANGE) as Line;
    const b1 = new Brace(line);
    const b1text = b1.getText("Horizontal distance");
    const b2 = new Brace(line, { direction: (line.copy() as Line).rotate(PI / 2).getUnitVector() });
    const b2text = b2.getTex("x-x_1");
    this.add(line, dot, dot2, b1, b2, b1text, b2text);
    await this.wait(1);
  }
}

await demoRender(BraceAnnotation, import.meta.url);

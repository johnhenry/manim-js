// Port of Manim CE gallery: MovingAround (ref/MovingAround.py).

import { Scene, Square, BLUE, ORANGE, LEFT } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class MovingAround extends Scene {
  async construct() {
    const square = new Square({ color: BLUE, fillOpacity: 1 });

    await this.play(square.animate.shift(LEFT));
    await this.play(square.animate.setFill(ORANGE));
    await this.play(square.animate.scale(0.3));
    await this.play(square.animate.rotate(0.4));
  }
}

await demoRender(MovingAround, import.meta.url);

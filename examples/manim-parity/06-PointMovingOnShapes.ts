// Port of Manim CE gallery: PointMovingOnShapes (ref/PointMovingOnShapes.py).

import {
  Scene, Circle, Dot, Line, GrowFromCenter, Transform, MoveAlongPath, Rotating,
  BLUE, RIGHT, rate_functions,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class PointMovingOnShapes extends Scene {
  async construct() {
    const circle = new Circle({ radius: 1, color: BLUE });
    const dot = new Dot();
    const dot2 = dot.copy().shift(RIGHT);
    this.add(dot);

    const line = new Line([3, 0, 0], [5, 0, 0]);
    this.add(line);

    await this.play(new GrowFromCenter(circle));
    await this.play(new Transform(dot, dot2));
    await this.play(new MoveAlongPath(dot, circle), { runTime: 2, rateFunc: rate_functions.linear });
    await this.play(new Rotating(dot, { aboutPoint: [2, 0, 0] }), { runTime: 1.5 });
    await this.wait(1);
  }
}

await demoRender(PointMovingOnShapes, import.meta.url);

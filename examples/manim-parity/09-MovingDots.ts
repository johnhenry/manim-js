// Port of Manim CE gallery: MovingDots (ref/MovingDots.py).

import { Scene, Dot, VGroup, Line, ValueTracker, BLUE, GREEN, RED, RIGHT } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class MovingDots extends Scene {
  async construct() {
    const d1 = new Dot({ color: BLUE });
    const d2 = new Dot({ color: GREEN });
    const dg = new VGroup(d1, d2).arrange(RIGHT, 1);
    void dg;
    const l1 = new Line(d1.getCenter(), d2.getCenter()).setColor(RED) as Line;
    const x = new ValueTracker(0);
    const y = new ValueTracker(0);
    d1.addUpdater((z: any) => z.setX(x.getValue()));
    d2.addUpdater((z: any) => z.setY(y.getValue()));
    l1.addUpdater((z: any) => z.become(new Line(d1.getCenter(), d2.getCenter())));
    this.add(d1, d2, l1);
    await this.play(x.animate.setValue(5));
    await this.play(y.animate.setValue(4));
    await this.wait(1);
  }
}

await demoRender(MovingDots, import.meta.url);

// Port of Manim CE gallery: PointWithTrace (ref/PointWithTrace.py) — a trace
// grown per-frame via addPointsAsCorners (added in the parity pass).

import { Scene, VMobject, Dot, Rotating, PI, RIGHT, UP, LEFT } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class PointWithTrace extends Scene {
  async construct() {
    const path = new VMobject();
    const dot = new Dot();
    path.setPointsAsCorners([dot.getCenter(), dot.getCenter()]);
    const updatePath = (p: any) => {
      const previousPath = p.copy();
      previousPath.addPointsAsCorners([dot.getCenter()]);
      p.become(previousPath);
    };
    path.addUpdater(updatePath);
    this.add(path, dot);
    await this.play(new Rotating(dot, { angle: PI, aboutPoint: RIGHT, runTime: 2 }));
    await this.wait(1);
    await this.play(dot.animate.shift(UP));
    await this.play(dot.animate.shift(LEFT));
    await this.wait(1);
  }
}

await demoRender(PointWithTrace, import.meta.url);

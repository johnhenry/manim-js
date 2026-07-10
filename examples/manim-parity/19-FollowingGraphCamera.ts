// Port of Manim CE gallery: FollowingGraphCamera (ref/FollowingGraphCamera.py)
// — the camera frame follows a dot along a plot (graph.tMin/tMax added in the
// parity pass).

import {
  MovingCameraScene, Axes, Dot, MoveAlongPath, Restore,
  BLUE, ORANGE, PI, rate_functions,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class FollowingGraphCamera extends MovingCameraScene {
  async construct() {
    this.camera!.frame!.saveState();

    // create the axes and the curve
    const ax = new Axes({ xRange: [-1, 10], yRange: [-1, 10] });
    const graph = ax.plot((x) => Math.sin(x), { color: BLUE, xRange: [0, 3 * PI] }) as any;

    // create dots based on the graph
    const movingDot = new Dot({ point: ax.i2gp(graph.tMin, graph), color: ORANGE });
    const dot1 = new Dot({ point: ax.i2gp(graph.tMin, graph) });
    const dot2 = new Dot({ point: ax.i2gp(graph.tMax, graph) });

    this.add(ax, graph, dot1, dot2, movingDot);
    await this.play(this.camera!.frame!.animate.scale(0.5).moveTo(movingDot.getCenter()));

    const updateCurve = (mob: any) => { mob.moveTo(movingDot.getCenter()); };

    this.camera!.frame!.addUpdater(updateCurve);
    await this.play(new MoveAlongPath(movingDot, graph, { rateFunc: rate_functions.linear }));
    this.camera!.frame!.removeUpdater(updateCurve);

    await this.play(new Restore(this.camera!.frame!));
  }
}

await demoRender(FollowingGraphCamera, import.meta.url);

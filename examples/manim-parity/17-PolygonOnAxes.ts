// Port of Manim CE gallery: PolygonOnAxes (ref/PolygonOnAxes.py) —
// always_redraw polygon tracking a ValueTracker on axes.

import {
  Scene, Axes, Polygon, Dot, ValueTracker, Create, alwaysRedraw, BLUE, YELLOW_D, YELLOW_B,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class PolygonOnAxes extends Scene {
  getRectangleCorners(bottomLeft: number[], topRight: number[]): number[][] {
    return [
      [topRight[0], topRight[1]],
      [bottomLeft[0], topRight[1]],
      [bottomLeft[0], bottomLeft[1]],
      [topRight[0], bottomLeft[1]],
    ];
  }

  async construct() {
    const ax = new Axes({
      xRange: [0, 10], yRange: [0, 10], xLength: 6, yLength: 6,
      axisConfig: { includeTip: false },
    });

    const t = new ValueTracker(5);
    const k = 25;

    const graph = ax.plot((x) => k / x, {
      color: YELLOW_D, xRange: [k / 10, 10.0, 0.01],
    });

    const getRectangle = () => {
      const polygon = new Polygon(
        this.getRectangleCorners([0, 0], [t.getValue(), k / t.getValue()]).map((c) => ax.c2p(c[0], c[1])),
      );
      polygon.strokeWidth = 1;
      polygon.setFill(BLUE, { opacity: 0.5 });
      polygon.setStroke(YELLOW_B);
      return polygon;
    };

    const polygon = alwaysRedraw(getRectangle);

    const dot = new Dot();
    dot.addUpdater((x: any) => x.moveTo(ax.c2p(t.getValue(), k / t.getValue())));
    dot.setZIndex(10);

    this.add(ax, graph, dot);
    await this.play(new Create(polygon as any));
    await this.play(t.animate.setValue(10));
    await this.play(t.animate.setValue(k / 10));
    await this.play(t.animate.setValue(5));
  }
}

await demoRender(PolygonOnAxes, import.meta.url);

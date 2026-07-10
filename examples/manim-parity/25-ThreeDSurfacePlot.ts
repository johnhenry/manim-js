// Port of Manim CE gallery: ThreeDSurfacePlot (ref/ThreeDSurfacePlot.py) —
// gaussian surface with setStyle + setFillByCheckerboard (parity pass).

import { ThreeDScene, ThreeDAxes, Surface, DEGREES, ORIGIN, GREEN, ORANGE, BLUE } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class ThreeDSurfacePlot extends ThreeDScene {
  async construct() {
    const resolutionFa = 24;
    this.setCameraOrientation({ phi: 75 * DEGREES, theta: -30 * DEGREES });

    const paramGauss = (u: number, v: number): number[] => {
      const x = u;
      const y = v;
      const sigma = 0.4, mu = [0.0, 0.0];
      const d = Math.hypot(x - mu[0], y - mu[1]);
      const z = Math.exp(-(d ** 2 / (2.0 * sigma ** 2)));
      return [x, y, z];
    };

    const gaussPlane = new Surface(paramGauss, {
      resolution: [resolutionFa, resolutionFa],
      vRange: [-2, 2],
      uRange: [-2, 2],
    });

    gaussPlane.scale(2, { aboutPoint: ORIGIN });
    gaussPlane.setStyle({ fillOpacity: 1, strokeColor: GREEN });
    gaussPlane.setFillByCheckerboard(ORANGE, BLUE, { opacity: 0.5 });
    const axes = new ThreeDAxes();
    this.add(axes, gaussPlane);
    await this.wait(1);
  }
}

await demoRender(ThreeDSurfacePlot, import.meta.url);

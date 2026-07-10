// Port of Manim CE gallery: ThreeDLightSourcePosition
// (ref/ThreeDLightSourcePosition.py) — lightSource proxy added in the parity
// pass (self.renderer.camera.light_source.move_to -> scene.lightSource.moveTo).

import { ThreeDScene, ThreeDAxes, Surface, DEGREES, PI, TAU, IN, RED_D, RED_E } from "../../src/node.ts";
import * as V from "../../src/core/math/vector.ts";
import { demoRender } from "./_run.ts";

class ThreeDLightSourcePosition extends ThreeDScene {
  async construct() {
    const axes = new ThreeDAxes();
    const sphere = new Surface(
      (u, v) => [
        1.5 * Math.cos(u) * Math.cos(v),
        1.5 * Math.cos(u) * Math.sin(v),
        1.5 * Math.sin(u),
      ],
      { vRange: [0, TAU], uRange: [-PI / 2, PI / 2], checkerboardColors: [RED_D, RED_E], resolution: [15, 32] },
    );
    this.lightSource.moveTo(V.scale(IN, 3)); // changes the source of the light
    this.setCameraOrientation({ phi: 75 * DEGREES, theta: 30 * DEGREES });
    this.add(axes, sphere);
    await this.wait(1);
  }
}

await demoRender(ThreeDLightSourcePosition, import.meta.url);

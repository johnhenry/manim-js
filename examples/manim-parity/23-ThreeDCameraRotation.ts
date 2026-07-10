// Port of Manim CE gallery: ThreeDCameraRotation (ref/ThreeDCameraRotation.py).

import { ThreeDScene, ThreeDAxes, Circle, DEGREES } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class ThreeDCameraRotation extends ThreeDScene {
  async construct() {
    const axes = new ThreeDAxes();
    const circle = new Circle();
    this.setCameraOrientation({ phi: 75 * DEGREES, theta: 30 * DEGREES });
    this.add(circle, axes);
    this.beginAmbientCameraRotation({ rate: 0.1 });
    await this.wait(1);
    this.stopAmbientCameraRotation();
    await this.moveCamera({ phi: 75 * DEGREES, theta: 30 * DEGREES });
    await this.wait(1);
  }
}

await demoRender(ThreeDCameraRotation, import.meta.url);

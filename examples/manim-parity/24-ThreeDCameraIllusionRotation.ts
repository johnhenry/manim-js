// Port of Manim CE gallery: ThreeDCameraIllusionRotation
// (ref/ThreeDCameraIllusionRotation.py).

import { ThreeDScene, ThreeDAxes, Circle, DEGREES, PI } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class ThreeDCameraIllusionRotation extends ThreeDScene {
  async construct() {
    const axes = new ThreeDAxes();
    const circle = new Circle();
    this.setCameraOrientation({ phi: 75 * DEGREES, theta: 30 * DEGREES });
    this.add(circle, axes);
    this.begin3dillusionCameraRotation({ rate: 2 });
    await this.wait(PI / 2);
    this.stop3dillusionCameraRotation();
  }
}

await demoRender(ThreeDCameraIllusionRotation, import.meta.url);

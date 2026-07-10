// Port of Manim CE gallery: FixedInFrameMObjectTest
// (ref/FixedInFrameMObjectTest.py).

import { ThreeDScene, ThreeDAxes, Text, DEGREES, UL } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class FixedInFrameMObjectTest extends ThreeDScene {
  async construct() {
    const axes = new ThreeDAxes();
    this.setCameraOrientation({ phi: 75 * DEGREES, theta: -45 * DEGREES });
    const text3d = new Text("This is a 3D text");
    this.addFixedInFrameMobjects(text3d);
    text3d.toCorner(UL);
    this.add(axes);
    await this.wait(1);
  }
}

await demoRender(FixedInFrameMObjectTest, import.meta.url);

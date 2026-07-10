// Port of Motion Canvas docs: quickstart (ref/quickstart-1.tsx +
// quickstart-2.tsx) — the red circle that slides right while turning
// yellow, then back. 1:1 modulo the documented conventions (JSX ->
// constructors, yield* all(...) -> scene.play(...), px -> world units).

import { Scene, Circle, tweenTo } from "../../src/node.ts";
import { demoRender, px, pxLen } from "./_run.ts";

class Quickstart extends Scene {
  async construct() {
    const myCircle = new Circle({
      // try changing these properties:
      radius: pxLen(140) / 2,
      fillColor: "#e13238",
      fillOpacity: 1,
      strokeWidth: 0,
    });
    myCircle.moveTo(px(-300, 0));
    this.add(myCircle);

    await this.play(
      tweenTo(myCircle, { x: px(300)[0] }, 1).to({ x: px(-300)[0] }, 1),
      tweenTo(myCircle, { fill: "#e6a700" }, 1).to({ fill: "#e13238" }, 1),
    );
  }
}

await demoRender(Quickstart, import.meta.url);

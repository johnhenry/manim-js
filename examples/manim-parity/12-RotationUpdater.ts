// Port of Manim CE gallery: RotationUpdater (ref/RotationUpdater.py) —
// dt-driven updaters with rotateAboutOrigin (added in the parity pass).

import { Scene, Line, ORIGIN, LEFT, WHITE, YELLOW } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class RotationUpdater extends Scene {
  async construct() {
    const updaterForth = (mobj: any, dt: number) => { mobj.rotateAboutOrigin(dt); };
    const updaterBack = (mobj: any, dt: number) => { mobj.rotateAboutOrigin(-dt); };
    const lineReference = new Line(ORIGIN, LEFT).setColor(WHITE) as Line;
    const lineMoving = new Line(ORIGIN, LEFT).setColor(YELLOW) as Line;
    lineMoving.addUpdater(updaterForth);
    this.add(lineReference, lineMoving);
    await this.wait(2);
    lineMoving.removeUpdater(updaterForth);
    lineMoving.addUpdater(updaterBack);
    await this.wait(2);
    lineMoving.removeUpdater(updaterBack);
    await this.wait(0.5);
  }
}

await demoRender(RotationUpdater, import.meta.url);

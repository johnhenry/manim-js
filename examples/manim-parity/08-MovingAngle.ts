// Port of Manim CE gallery: MovingAngle (ref/MovingAngle.py) — ValueTracker-
// driven angle with become() updaters (uses incrementValue from the parity
// pass).

import {
  Scene, Line, Angle, MathTex, ValueTracker,
  LEFT, RIGHT, RED, DEGREES, SMALL_BUFF,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class MovingAngle extends Scene {
  async construct() {
    const rotationCenter = LEFT;

    const thetaTracker = new ValueTracker(110);
    const line1 = new Line(LEFT, RIGHT);
    const lineMoving = new Line(LEFT, RIGHT);
    const lineRef = lineMoving.copy();
    lineMoving.rotate(thetaTracker.getValue() * DEGREES, { aboutPoint: rotationCenter });
    const a = new Angle(line1, lineMoving, { radius: 0.5, otherAngle: false });
    const tex = new MathTex("\\theta").moveTo(
      new Angle(line1, lineMoving, { radius: 0.5 + 3 * SMALL_BUFF, otherAngle: false }).pointFromProportion(0.5),
    );

    this.add(line1, lineMoving, a, tex);
    await this.wait(1);

    lineMoving.addUpdater((x: any) =>
      x.become(lineRef.copy()).rotate(thetaTracker.getValue() * DEGREES, { aboutPoint: rotationCenter }),
    );
    a.addUpdater((x: any) =>
      x.become(new Angle(line1, lineMoving, { radius: 0.5, otherAngle: false })),
    );
    tex.addUpdater((x: any) =>
      x.moveTo(new Angle(line1, lineMoving, { radius: 0.5 + 3 * SMALL_BUFF, otherAngle: false }).pointFromProportion(0.5)),
    );

    await this.play(thetaTracker.animate.setValue(40));
    await this.play(thetaTracker.animate.incrementValue(140));
    await this.play(tex.animate.setColor(RED), { runTime: 0.5 });
    await this.play(thetaTracker.animate.setValue(350));
  }
}

await demoRender(MovingAngle, import.meta.url);

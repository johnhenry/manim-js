// Port of Manim CE gallery: SineCurveUnitCircle (ref/SineCurveUnitCircle.py)
// — a dot orbiting the unit circle traces out the sine curve.

import {
  Scene, Circle, Dot, Line, VGroup, MathTex, alwaysRedraw,
  BLUE, YELLOW, DOWN, YELLOW_A, YELLOW_D,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class SineCurveUnitCircle extends Scene {
  originPoint!: number[];
  curveStart!: number[];
  circle!: Circle;
  curve!: VGroup;
  tOffset = 0;

  async construct() {
    this.showAxis();
    this.showCircle();
    await this.moveDotAndDrawCurve();
    await this.wait(1);
  }

  showAxis() {
    const xAxis = new Line([-6, 0, 0], [6, 0, 0]);
    const yAxis = new Line([-4, -2, 0], [-4, 2, 0]);
    this.add(xAxis, yAxis);
    this.addXLabels();
    this.originPoint = [-4, 0, 0];
    this.curveStart = [-3, 0, 0];
  }

  addXLabels() {
    const xLabels = [
      new MathTex("\\pi"), new MathTex("2 \\pi"),
      new MathTex("3 \\pi"), new MathTex("4 \\pi"),
    ];
    for (let i = 0; i < xLabels.length; i++) {
      xLabels[i].nextTo([-1 + 2 * i, 0, 0], DOWN);
      this.add(xLabels[i]);
    }
  }

  showCircle() {
    const circle = new Circle({ radius: 1 });
    circle.moveTo(this.originPoint);
    this.add(circle);
    this.circle = circle;
  }

  async moveDotAndDrawCurve() {
    const orbit = this.circle;
    const originPoint = this.originPoint;

    const dot = new Dot({ radius: 0.08, color: YELLOW });
    dot.moveTo(orbit.pointFromProportion(0));
    this.tOffset = 0;
    const rate = 0.25;

    const goAroundCircle = (mob: any, dt: number) => {
      this.tOffset += dt * rate;
      mob.moveTo(orbit.pointFromProportion(this.tOffset % 1));
    };

    const getLineToCircle = () => new Line(originPoint, dot.getCenter(), { color: BLUE });

    const getLineToCurve = () => {
      const x = this.curveStart[0] + this.tOffset * 4;
      const y = dot.getCenter()[1];
      return new Line(dot.getCenter(), [x, y, 0], { color: YELLOW_A, strokeWidth: 2 });
    };

    this.curve = new VGroup();
    this.curve.add(new Line(this.curveStart, this.curveStart));
    const getCurve = () => {
      const lastLine = this.curve.submobjects[this.curve.submobjects.length - 1] as Line;
      const x = this.curveStart[0] + this.tOffset * 4;
      const y = dot.getCenter()[1];
      const newLine = new Line(lastLine.getEnd(), [x, y, 0], { color: YELLOW_D });
      this.curve.add(newLine);
      return this.curve;
    };

    dot.addUpdater(goAroundCircle);

    const originToCircleLine = alwaysRedraw(getLineToCircle);
    const dotToCurveLine = alwaysRedraw(getLineToCurve);
    const sineCurveLine = alwaysRedraw(getCurve);

    this.add(dot);
    this.add(orbit, originToCircleLine, dotToCurveLine, sineCurveLine);
    await this.wait(8.5);

    dot.removeUpdater(goAroundCircle);
  }
}

await demoRender(SineCurveUnitCircle, import.meta.url);

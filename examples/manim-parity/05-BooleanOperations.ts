// Port of Manim CE gallery: BooleanOperations (ref/BooleanOperations.py) —
// Union/Intersection/Exclusion/Difference with the trailing style config
// added in the parity pass; font_size ports via fontSizePt.

import {
  Scene, Ellipse, MarkupText, Text, Group, FadeIn,
  Intersection, Union, Exclusion, Difference,
  BLUE, RED, GREEN, ORANGE, YELLOW, PINK,
  LEFT, RIGHT, UP, DOWN, fontSizePt,
} from "../../src/node.ts";
import * as V from "../../src/core/math/vector.ts";
import { demoRender } from "./_run.ts";

class BooleanOperations extends Scene {
  async construct() {
    const ellipse1 = new Ellipse({
      width: 4.0, height: 5.0, fillOpacity: 0.5, color: BLUE, strokeWidth: 10,
    }).moveTo(LEFT) as Ellipse;
    const ellipse2 = (ellipse1.copy() as Ellipse).setColor(RED).moveTo(RIGHT) as Ellipse;
    const boolOpsText = new MarkupText("Boolean Operation").nextTo(ellipse1, V.scale(UP, 3));
    const ellipseGroup = new Group(boolOpsText, ellipse1, ellipse2).moveTo(V.scale(LEFT, 3));
    await this.play(new FadeIn(ellipseGroup));

    const i = new Intersection(ellipse1, ellipse2, { color: GREEN, fillOpacity: 0.5 });
    await this.play(i.animate.scale(0.25).moveTo(V.add(V.scale(RIGHT, 5), V.scale(UP, 2.5))));
    const intersectionText = new Text("Intersection", { fontSize: fontSizePt(23) }).nextTo(i, UP);
    await this.play(new FadeIn(intersectionText));

    const u = new Union(ellipse1, ellipse2, { color: ORANGE, fillOpacity: 0.5 });
    const unionText = new Text("Union", { fontSize: fontSizePt(23) });
    await this.play(u.animate.scale(0.3).nextTo(i, DOWN, unionText.getHeight() * 3));
    unionText.nextTo(u, UP);
    await this.play(new FadeIn(unionText));

    const e = new Exclusion(ellipse1, ellipse2, { color: YELLOW, fillOpacity: 0.5 });
    const exclusionText = new Text("Exclusion", { fontSize: fontSizePt(23) });
    await this.play(e.animate.scale(0.3).nextTo(u, DOWN, exclusionText.getHeight() * 3.5));
    exclusionText.nextTo(e, UP);
    await this.play(new FadeIn(exclusionText));

    const d = new Difference(ellipse1, ellipse2, { color: PINK, fillOpacity: 0.5 });
    const differenceText = new Text("Difference", { fontSize: fontSizePt(23) });
    await this.play(d.animate.scale(0.3).nextTo(u, LEFT, differenceText.getHeight() * 3.5));
    differenceText.nextTo(d, UP);
    await this.play(new FadeIn(differenceText));
    await this.wait(0.5);
  }
}

await demoRender(BooleanOperations, import.meta.url);

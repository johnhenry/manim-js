// Port of Manim CE gallery: OpeningManim (ref/OpeningManim.py) — the classic
// opening: Tex + MathTex, then a NumberPlane warped by a nonlinear function
// (prepareForNonlinearTransform, added in the parity pass).

import {
  Scene, Tex, MathTex, NumberPlane, VGroup,
  Write, FadeIn, FadeOut, Transform, Create, LaggedStart,
  DOWN, UP, UL, fontSizePt,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class OpeningManim extends Scene {
  async construct() {
    const title = new Tex("This is some \\LaTeX");
    const basel = new MathTex("\\sum_{n=1}^\\infty \\frac{1}{n^2} = \\frac{\\pi^2}{6}");
    new VGroup(title, basel).arrange(DOWN);
    await this.play(
      new Write(title),
      new FadeIn(basel, { shift: DOWN }),
    );
    await this.wait(1);

    const transformTitle = new Tex("That was a transform");
    transformTitle.toCorner(UL);
    await this.play(
      new Transform(title, transformTitle),
      new LaggedStart(basel.submobjects.map((obj: any) => new FadeOut(obj, { shift: DOWN }))),
    );
    await this.wait(1);

    const grid = new NumberPlane();
    const gridTitle = new Tex("This is a grid", { fontSize: fontSizePt(72) });
    gridTitle.moveTo(transformTitle.getCenter());

    this.add(grid, gridTitle); // Make sure title is on top of grid
    await this.play(
      new FadeOut(title),
      new FadeIn(gridTitle, { shift: UP }),
      new Create(grid, { runTime: 3, lagRatio: 0.1 }),
    );
    await this.wait(1);

    const gridTransformTitle = new Tex("That was a non-linear function applied to the grid");
    gridTransformTitle.moveTo(gridTitle.getCenter());
    grid.prepareForNonlinearTransform();
    await this.play(
      grid.animate.applyFunction((p: number[]) => [
        p[0] + Math.sin(p[1]),
        p[1] + Math.sin(p[0]),
        p[2],
      ]),
      { runTime: 3 },
    );
    await this.wait(1);
    await this.play(new Transform(gridTitle, gridTransformTitle));
    await this.wait(1);
  }
}

await demoRender(OpeningManim, import.meta.url);

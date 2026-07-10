// Port of Motion Canvas docs: CubicBezier + QuadBezier snippets
// (ref/bezier-1.tsx, both fenced snippets merged — trivial variants of one
// page). Each curve draws in via `end` then un-draws via `start`, exactly
// like the originals; strokeStart/strokeEnd are the MC start/end pair.

import { Scene, CubicBezier, QuadBezier, tweenTo } from "../../src/node.ts";
import { demoRender, px } from "./_run.ts";

class BezierNodes extends Scene {
  async construct() {
    // --- snippet: Cubic Bézier ---
    const bezier = new CubicBezier({
      strokeWidth: 6,
      strokeColor: "lightseagreen",
      p0: px(-200, -70),
      p1: px(120, -120),
      p2: px(-120, 120),
      p3: px(200, 70),
    });
    (bezier as any).strokeEnd = 0;
    this.add(bezier);

    await this.play(tweenTo(bezier, { end: 1 }, 1));
    await this.play(tweenTo(bezier, { start: 1 }, 1).to({ start: 0 }, 1));
    this.remove(bezier);

    // --- snippet: Quadratic Bézier ---
    const quad = new QuadBezier({
      strokeWidth: 6,
      strokeColor: "lightseagreen",
      p0: px(-150, 50),
      p1: px(0, -120),
      p2: px(150, 50),
    });
    (quad as any).strokeEnd = 0;
    this.add(quad);

    await this.play(tweenTo(quad, { end: 1 }, 1));
    await this.play(tweenTo(quad, { start: 1 }, 1).to({ start: 0 }, 1));
  }
}

await demoRender(BezierNodes, import.meta.url);

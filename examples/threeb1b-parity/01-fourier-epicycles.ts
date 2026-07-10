// Recreation of the "But what is a Fourier series?" epicycles visual
// (3b1b, 2019): a closed drawing (a pi glyph) is traced by a chain of
// rotating vectors from the complex DFT of the path; the chain tip leaves
// a glowing trail. Staged vector-count reveal: 1 -> 2 -> 10 -> 100.
// Recreation of the visual, not a code port.

import {
  Scene, MathTex, Text, FadeIn, FadeOut,
  FourierPath, dftOfPath, samplePath, TracedPath,
} from "../../src/node.ts";
import type { VMobject } from "../../src/mobject/VMobject.ts";
import { demoRender } from "./_run.ts";

class FourierEpicycles extends Scene {
  async construct() {
    // The drawing to trace: the outline of a pi glyph. MathTex default size
    // ~= manim 48pt (a fraction of a world unit tall), so scale up to a
    // drawing ~3.5 units tall, centered at the origin.
    const tex = new MathTex("\\pi").scale(5);
    tex.moveTo([0, 0, 0]);
    const glyph = tex
      .getFamily()
      .find((m: any) => m.points && m.points.length > 0) as VMobject;
    const pts = samplePath(glyph, 256);
    // One DFT; dftOfPath returns coefficients sorted by descending amplitude,
    // so each stage is just the n largest terms.
    const coeffs = dftOfPath(pts);

    // Vector-count reveal per CANON: 1 -> 2 -> 10 -> 100, each stage tracing
    // one full period. Early stages get a dissipating trail (the "noise");
    // the final 100-vector stage keeps a persistent trail: the drawing emerges.
    const stages = [
      { n: 1, period: 3.5, dissipate: 2.2 as number | null },
      { n: 2, period: 3.5, dissipate: 2.2 as number | null },
      { n: 10, period: 4.5, dissipate: 3.2 as number | null },
      { n: 100, period: 8, dissipate: null as number | null },
    ];

    let prevLabel: Text | null = null;
    for (const { n, period, dissipate } of stages) {
      const fp = new FourierPath({
        coefficients: coeffs.slice(0, n),
        speed: 1 / period, // one full traversal per stage
        showCircles: true,
        circleStyle: { strokeColor: "#58C4DD", strokeWidth: 1, strokeOpacity: 0.25 },
        vectorStyle: { strokeColor: "#FFFFFF", strokeWidth: 2, strokeOpacity: 0.9 },
      });
      const label = new Text(`${n} vector${n === 1 ? "" : "s"}`, {
        fontSize: 0.45,
        color: "#58C4DD",
      });
      label.toCorner([-1, 1, 0], 0.6); // top-left, width-safe for "100 vectors"

      const entrances: any[] = [
        new FadeIn(fp, { runTime: 0.6 }),
        new FadeIn(label, { runTime: 0.6 }),
      ];
      if (prevLabel) entrances.push(new FadeOut(prevLabel, { runTime: 0.6 }));
      await this.play(...entrances);
      prevLabel = label;

      // Drive the chain (updater advances the internal clock during wait)
      // and trace the tip with the glowing yellow trail.
      fp.attachTo(this);
      const trail = new TracedPath(() => fp.tip, {
        strokeColor: "#FFFF00",
        strokeWidth: 3.5,
        dissipatingTime: dissipate,
      });
      this.add(trail);
      await this.wait(period);

      if (n < 100) {
        await this.play(
          new FadeOut(fp, { runTime: 0.5 }),
          new FadeOut(trail, { runTime: 0.5 }),
        );
      } else {
        // Final beat: fade the epicycle machinery, leave the emerged drawing.
        await this.play(new FadeOut(fp, { runTime: 1 }));
        await this.wait(1.5);
      }
    }
  }
}

await demoRender(FourierEpicycles, import.meta.url, { mathTex: true });

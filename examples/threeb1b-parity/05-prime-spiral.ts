// Recreation of the "Why do prime numbers make these spirals?" visual
// (3b1b, 2019): every integer n plotted at polar (r, theta) = (n, n) forms
// an Archimedean spiral; fading the composites leaves the prime galaxy, and
// zooming out (twice) reveals the spiral arms. Recreation of the visual,
// not a code port.

import {
  Dot, VGroup, FadeIn, FadeOut, FadeToColor, LaggedStart,
  MovingCameraScene, sieve,
  BLUE_C, GREY,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const NMAX = 3000;
const C = 0.05; // world units per n: r = C*n, so r_max = 150
// Radial bands (by n) so the dots appear in outward waves; the first few
// bands fall inside the initial viewport, the rest are revealed by zooming.
const BAND_EDGES = [1, 40, 90, 145, 300, 600, 1100, 1900, NMAX + 1];

function primeDot(n: number): Dot {
  const r = C * n;
  return new Dot({
    point: [r * Math.cos(n), r * Math.sin(n), 0],
    // Radius grows with r so screen size stays roughly constant across the
    // zoom-out stages (camera width scales with the radius being shown).
    radius: 0.03 + 0.0006 * n,
    color: GREY,
    fillOpacity: 0.8,
  });
}

class PrimeSpiral extends MovingCameraScene {
  async construct() {
    const isP = sieve(NMAX);

    // One composite band + one prime band per radial shell, so the composite
    // fade / prime recolor can run on whole bands (render-feasible counts).
    const compBands: VGroup[] = [];
    const primeBands: VGroup[] = [];
    for (let b = 0; b < BAND_EDGES.length - 1; b++) {
      const comp = new VGroup();
      const prim = new VGroup();
      for (let n = BAND_EDGES[b]; n < BAND_EDGES[b + 1]; n++) {
        (isP[n] ? prim : comp).add(primeDot(n));
      }
      comp.cacheStatic();
      prim.cacheStatic();
      compBands.push(comp);
      primeBands.push(prim);
    }

    // Dots appear in outward waves (band by band).
    const waves: any[] = [];
    for (let b = 0; b < compBands.length; b++) {
      waves.push(new FadeIn(compBands[b]), new FadeIn(primeBands[b]));
    }
    await this.play(new LaggedStart(waves, { lagRatio: 0.22, runTime: 4 }));
    await this.wait(0.6);

    // Composites fade away while the primes light up.
    await this.play(
      ...compBands.map((b) => new FadeOut(b)),
      ...primeBands.map((b) => new FadeToColor(b, BLUE_C)),
      { runTime: 1.8 },
    );
    await this.wait(0.6);

    // Zoom stage 1: the tight spiral opens into curving arms.
    const frame = this.getFrame();
    await this.play(frame.animate.scale(8), { runTime: 3 });
    await this.wait(0.8);

    // Zoom stage 2: the full prime galaxy (r up to C*NMAX = 150).
    await this.play(frame.animate.scale(2.85), { runTime: 3 });
    await this.wait(1.5);
  }
}

await demoRender(PrimeSpiral, import.meta.url, { mathTex: false });

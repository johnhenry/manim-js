// GSAP parity demo 02: ref/02-stagger-distributions.md — the object form of
// GSAP's `stagger` special property (`gsap.com/resources/getting-started/
// Staggers`): a `grid`-shaped set of targets gets a per-target start-time
// offset shaped by a `from` distribution ("center"/"edges"/"random", not
// plain array order). Uses staggerGrid() (src/animation/stagger.ts) to
// compute each grid cell's spatial delay.
//
// IMPORTANT DISCOVERY (see composition.ts): LaggedStartMap/AnimationGroup
// only support a single scalar `lagRatio` applied cumulatively in ARRAY
// ORDER (composition.ts's `_buildTimings`: `curr = mix(start, end,
// lagRatio)` walked over `animations` in list order) -- there is no hook
// anywhere in Animation/AnimationConfig for an arbitrary per-item start
// delay. So a staggerGrid() delay factory (whose values are NOT monotonic
// in flat grid-index order for "center"/"edges"/"random") cannot be handed
// to LaggedStartMap as-is and produce the right propagation shape: feeding
// it in original index order would just look like a plain sequential
// stagger. The fix used below: compute staggerGrid()'s per-cell delay, SORT
// the mobjects by that delay, then hand the sorted array to LaggedStartMap
// with a uniform lagRatio. staggerGrid() supplies the *order* (true 2D
// spatial proximity); LaggedStartMap's lagRatio supplies the even
// time-spacing once that order is established. This is not a library bug --
// just the composition boundary between "value distribution" (stagger.ts)
// and "sequencing" (composition.ts) -- flagging it since the campaign brief
// asked to trace this rather than guess.

import { Scene, Dot, LaggedStartMap, FadeOut, FadeIn, Text, staggerGrid, WHITE, GREEN } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const ROWS = 5;
const COLS = 5;
const SPACING = 1.15;
const DOT_COLOR = "#4fd1c5"; // teal, clearly visible on black
const DOT_RADIUS = 0.22;

function makeGrid(): Dot[] {
  const dots: Dot[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c - (COLS - 1) / 2) * SPACING;
      const y = ((ROWS - 1) / 2 - r) * SPACING - 0.3;
      dots.push(new Dot({ radius: DOT_RADIUS, color: DOT_COLOR, fillOpacity: 1 }).moveTo([x, y, 0]));
    }
  }
  return dots;
}

// Order a flat grid-index-ordered mobject list by staggerGrid()'s per-cell
// delay (ascending), so LaggedStartMap's array-order + lagRatio sequencing
// reproduces the spatial propagation shape staggerGrid() computed. See the
// header comment for why this indirection is necessary.
function orderByStaggerGrid<T>(items: T[], from: "center" | "edges" | "random"): T[] {
  const delayOf = staggerGrid({ grid: [ROWS, COLS], from });
  return items
    .map((item, i) => ({ item, delay: delayOf(null, i, items.length) }))
    .sort((a, b) => a.delay - b.delay)
    .map((x) => x.item);
}

class StaggerDistributions extends Scene {
  async construct() {
    // --- Phase 1: from: "center" -- ripples OUTWARD from the middle cell. ---
    const label1 = new Text('stagger: { grid: [5,5], from: "center" }', {
      fontSize: 0.32,
      color: WHITE,
      point: [0, 3.3, 0],
    });
    await this.play(new FadeIn(label1), { _playConfig: true, runTime: 0.4 });

    const gridA = makeGrid();
    const orderedA = orderByStaggerGrid(gridA, "center");
    await this.play(
      new LaggedStartMap(
        (m: any) => new FadeIn(m, { scale: 0.25, runTime: 0.5 }),
        orderedA,
        { lagRatio: 0.14 },
      ),
    );
    await this.wait(0.5);

    // Reset: fade the whole grid + label out together before the next phase.
    await this.play(
      new FadeOut(label1),
      ...gridA.map((d) => new FadeOut(d, { runTime: 0.4 })),
      { _playConfig: true, runTime: 0.4 },
    );

    // --- Phase 2: from: "random" -- deterministic-but-unpredictable order. ---
    const label2 = new Text('stagger: { grid: [5,5], from: "random" }', {
      fontSize: 0.32,
      color: WHITE,
      point: [0, 3.3, 0],
    });
    await this.play(new FadeIn(label2), { _playConfig: true, runTime: 0.4 });

    const gridB = makeGrid();
    gridB.forEach((d) => d.setColor(GREEN)); // distinct color so the two phases read apart in frame grabs
    const orderedB = orderByStaggerGrid(gridB, "random");
    await this.play(
      new LaggedStartMap(
        (m: any) => new FadeIn(m, { scale: 0.25, runTime: 0.5 }),
        orderedB,
        { lagRatio: 0.14 },
      ),
    );
    await this.wait(0.5);

    await this.play(
      new FadeOut(label2),
      ...gridB.map((d) => new FadeOut(d, { runTime: 0.4 })),
      { _playConfig: true, runTime: 0.4 },
    );
  }
}

await demoRender(StaggerDistributions, import.meta.url);

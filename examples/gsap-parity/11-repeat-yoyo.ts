// GSAP parity demo 11: ref/11-repeat-yoyo.md — repeat + yoyo ping-pong
// (GSAP docs, gsap.com/docs/v3/GSAP/Tween/: `repeat: -1, yoyo: true`).
// ecmanim's Repeat wrapper (src/animation/repeat.ts) confirmed by reading
// its RepeatConfig: the option is `count` (a finite integer >= 1 — Repeat's
// constructor throws on -1/Infinity by design, see its comment) and `yoyo`
// (odd-indexed cycles play the wrapped animation in reverse instead of
// resetting). There is no `repeat: -1` here.
//
// Honest divergence from the source pattern: GSAP's `repeat: -1` loops
// forever, which has no finite-video equivalent. This recreation substitutes
// a FINITE `count: 4` (two full back-and-forth round trips) — enough cycles
// to make the ping-pong (forward, reverse, forward, reverse) unmistakable
// without literally being infinite. This is an expected, documented
// substitution, not a bug.

import { Scene, Square, Transform, Repeat } from "../../src/node.ts";
import { easeInOutSine } from "../../src/animation/rate_functions.ts";
import { demoRender } from "./_run.ts";

class RepeatYoyo extends Scene {
  async construct() {
    const sq = new Square({ sideLength: 1, color: "#1dd1a1", fillOpacity: 1 });
    const leftX = -5;
    const rightX = 5;
    sq.moveTo([leftX, 0, 0]);
    this.add(sq);

    const target = sq.copy();
    target.moveTo([rightX, 0, 0]);

    // The wrapped tween: one leg of the ping-pong (left -> right).
    const leg = new Transform(sq, target, { runTime: 1.2, rateFunc: easeInOutSine });

    // count: 4, yoyo: true -> leg 1 forward (L->R), leg 2 reversed (R->L),
    // leg 3 forward (L->R), leg 4 reversed (R->L) -- no reset jump at any
    // cycle boundary, matching GSAP's yoyo semantics.
    const pingPong = new Repeat(leg, { count: 4, yoyo: true });

    await this.play(pingPong);
    await this.wait(0.5);
  }
}

await demoRender(RepeatYoyo, import.meta.url);

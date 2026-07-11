// GSAP parity demo 06: ref/06-flip-transition.md — the Flip plugin's
// First-Last-Invert-Play technique (gsap.com/docs/v3/Plugins/Flip/).
// `flipGetState()` snapshots each square's bounding box/points (the
// "First" state) BEFORE an instant layout change; the layout is then
// changed directly (no animation, just moveTo()/scale() -- the DOM-class-
// toggle equivalent); `flipFrom()` plays each square FROM its captured
// "First" state TO its now-current ("Last") state, so the instantaneous
// jump reads as one continuous glide instead of a cut.
//
// Concrete scenario (the classic "card expands to modal" FLIP analog): six
// small "cards" sit in a 3x2 grid. One card (the hero) instantly jumps to
// screen center and grows large, while the other five instantly collapse
// into a small fanned stack in the corner. flipFrom() then bridges both
// moves so they read as a smooth, simultaneous transition.

import { Scene, Square, VGroup, flipGetState, flipFrom } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const COLORS = ["#ff6b6b", "#feca57", "#48dbfb", "#1dd1a1", "#5f27cd", "#ff9ff3"];
const HERO_INDEX = 1; // top-middle card becomes the "expanded" one.

class FlipTransition extends Scene {
  async construct() {
    const cols = [-2.4, 0, 2.4];
    const rows = [1.3, -1.3];
    const squares = COLORS.map((c, i) => {
      const sq = new Square({ sideLength: 0.9, color: c, fillOpacity: 1 });
      sq.moveTo([cols[i % 3], rows[Math.floor(i / 3)], 0]);
      return sq;
    });
    this.add(new VGroup(...squares));

    // Show the "before" grid clearly so the layout change reads as a real
    // before/after story, not just an instant cut with no visible start.
    await this.wait(0.6);

    // 1. Capture the "First" state (GSAP: Flip.getState(".box")).
    const state = flipGetState(squares);

    // 2. Make the layout change INSTANTLY -- no animation here, exactly like
    // GSAP's `element.classList.toggle("full-screen")` step. The hero card
    // jumps to center and grows (grid slot -> modal); the rest collapse into
    // a small fanned stack in the corner.
    let stackIndex = 0;
    squares.forEach((sq, i) => {
      if (i === HERO_INDEX) {
        sq.scale(3.2);
        sq.moveTo([0, 0, 0]);
      } else {
        sq.scale(0.45);
        sq.moveTo([-5.6 + stackIndex * 0.22, -3.0 - stackIndex * 0.16, 0]);
        stackIndex++;
      }
    });

    // 3. Play the FLIP transition (GSAP: Flip.from(state, {...})): each
    // square animates from its captured "First" position/size to its
    // current "Last" one, so the instant jump above reads as a smooth move.
    await this.play(flipFrom(state, squares, { runTime: 1.3, lagRatio: 0.05 }));
    await this.wait(0.6);
  }
}

await demoRender(FlipTransition, import.meta.url);

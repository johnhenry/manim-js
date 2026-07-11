// GSAP parity demo 13: ref/13-onupdate-callback.md — onUpdate callback
// driving custom logic every tick alongside a tween (GSAP docs,
// gsap.com/docs/v3/GSAP/Tween/: `onUpdate` fires every frame with `this`
// bound to the tween so callbacks can read `this.progress()`).
//
// Mapped to ecmanim: `UpdateFromAlphaFunc` (src/animation/specialized.ts) is
// a SEPARATE Animation whose interpolateMobject(alpha) callback receives the
// tween's own eased alpha every frame — exactly "a callback that runs every
// tick alongside a tween's own interpolation" (confirmed against
// UpdateFromFunc, which gets NO alpha and doesn't fit "reading progress()").
// Precedent for this exact pairing: examples/threeb1b-parity/07-pendulum-
// phase.ts plays an UpdateFromAlphaFunc standalone; here it runs IN PARALLEL
// with a real Transform tween via `this.play(tween, sideEffect)` (Scene.play
// runs all passed animations together), so one is "driving" (the bar's own
// width tween) and the other is purely "driven" (a live percentage readout
// with no tween of its own) -- the driving-vs-driven relationship the brief
// asks for.

import {
  Scene, Rectangle, Text, DecimalNumber, Transform, UpdateFromAlphaFunc,
} from "../../src/node.ts";
import { linear } from "../../src/animation/rate_functions.ts";
import { demoRender } from "./_run.ts";

const DURATION = 3;
const BAR_MAX_WIDTH = 9;
const BAR_X = -BAR_MAX_WIDTH / 2; // left edge pinned here

class OnUpdateCallback extends Scene {
  async construct() {
    const title = new Text("onUpdate: readout driven every tick", {
      fontSize: 0.4, color: "#feca57",
    });
    title.moveTo([0, 3, 0]);
    this.add(title);

    // The tween: a bar's width grows from ~0 to BAR_MAX_WIDTH, left-edge
    // pinned, over DURATION seconds.
    const bar = new Rectangle({
      width: 0.01, height: 1, color: "#1dd1a1", fillOpacity: 1,
    });
    bar.moveTo([BAR_X, 0, 0], [-1, 0, 0]);
    this.add(bar);

    const barTarget = bar.copy();
    // stretch=true: grow width only, keep height fixed. setWidth's default
    // (stretch=false) scales uniformly, which would blow the height up too
    // (found by frame-verifying: the bar covered the whole screen and hid
    // the readout underneath it) since we're growing from a near-zero width.
    barTarget.setWidth(BAR_MAX_WIDTH, true);
    barTarget.moveTo([BAR_X, 0, 0], [-1, 0, 0]);
    const barTween = new Transform(bar, barTarget, { runTime: DURATION, rateFunc: linear });

    // The driven side effect: a live "NN%" readout, updated every frame from
    // the tween's OWN alpha (not its own independent animation) -- the
    // onUpdate-equivalent. Positioned well clear of the bar so it reads as
    // a separate element, not part of the tween.
    const readout = new DecimalNumber(0, {
      numDecimalPlaces: 0, unit: "%", fontSize: 0.9, color: "#48dbfb",
    });
    readout.moveTo([0, -2, 0]);
    this.add(readout);

    const sideEffect = new UpdateFromAlphaFunc(
      readout,
      (m: any, alpha: number) => m.setValue(Math.round(alpha * 100)),
      { runTime: DURATION, rateFunc: linear },
    );

    // Play the tween and the callback-driven side effect together: the bar
    // fills (its own interpolation) WHILE the percentage readout ticks up in
    // lockstep, driven purely by reading the tween's live alpha each frame.
    await this.play(barTween, sideEffect);
    await this.wait(0.5);
  }
}

await demoRender(OnUpdateCallback, import.meta.url);

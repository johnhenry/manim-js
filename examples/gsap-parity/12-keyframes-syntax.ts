// GSAP parity demo 12: ref/12-keyframes-syntax.md — the `keyframes: [...]`
// special property (gsap.com/docs/v3/GSAP/Tween/), which sequences several
// distinct states one after another inside a SINGLE tween call instead of a
// hand-chained sequence of separate `.to()` calls. Mirrors the docs' own
// illustrative snippet:
//
//   gsap.to(".box", { keyframes: [
//     { x: 100, duration: 1 },
//     { y: 100, duration: 0.5 },
//     { rotation: 360, duration: 1 },
//   ]});
//
// ecmanim's structured equivalent is `KeyframeTrack` (src/animation/
// keyframe_track.ts): a track of `{t, value, ease}` keyframes sampled via
// `.valueAt(t)`. Since KeyframeTrack interpolates ONE value type per track
// (not several independent Mobject properties at once), the pose {x, y,
// rot} is modeled as a single custom-interpolated value (a plain object,
// with a hand-written lerp passed as `options.interpolate` -- the default
// dispatch only handles number/number[]/Vec3, per the class's own doc
// comment). `PlayKeyframeTrack` (a real Animation, scene.play()-driven) then
// samples the track every frame and applies the pose to the square via an
// `apply(mobject, value)` callback -- moveTo() for position (absolute, safe
// every frame) and a delta rotate() for rotation (Mobject has no absolute-
// rotation setter, only relative rotate(), so the callback tracks the last
// applied angle in a closure and rotates by the difference each frame).

import { Scene, Square, KeyframeTrack, PlayKeyframeTrack } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

interface Pose {
  x: number;
  y: number;
  rot: number;
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, rot: a.rot + (b.rot - a.rot) * t };
}

class KeyframesSyntax extends Scene {
  async construct() {
    const basePos: [number, number, number] = [-4.6, 1.2, 0];
    const square = new Square({ sideLength: 1.1, color: "#48dbfb", fillOpacity: 1 });
    square.moveTo(basePos);
    this.add(square);

    // ONE track drives all three sequential stages -- GSAP's `keyframes`
    // array in track form. Each stage isolates a different property (x,
    // then y, then rotation) and gets its own ease, so the stage boundaries
    // read as distinct changes of motion quality, not just a blend.
    const track = new KeyframeTrack<Pose>(
      [
        { t: 0, value: { x: 0, y: 0, rot: 0 } },
        // Stage 1: move right.
        { t: 1.0, value: { x: 6.0, y: 0, rot: 0 }, ease: "easeInOutCubic" },
        // Stage 2: move down, with a little overshoot ease so the change of
        // axis is visually unmistakable.
        { t: 1.6, value: { x: 6.0, y: -3.0, rot: 0 }, ease: "easeOutBack" },
        // Stage 3: rotate a full turn, elastic settle -- the most visually
        // distinct ease of the three, making the final stage unmistakable.
        { t: 2.8, value: { x: 6.0, y: -3.0, rot: 2 * Math.PI }, ease: "easeOutElastic" },
      ],
      { interpolate: lerpPose },
    );

    let lastRot = 0;
    const anim = new PlayKeyframeTrack(square, track, (mob: any, pose: Pose) => {
      mob.moveTo([basePos[0] + pose.x, basePos[1] + pose.y, basePos[2]]);
      const dRot = pose.rot - lastRot;
      if (dRot !== 0) mob.rotate(dRot);
      lastRot = pose.rot;
    });

    await this.play(anim);
    await this.wait(0.5);
  }
}

await demoRender(KeyframesSyntax, import.meta.url);

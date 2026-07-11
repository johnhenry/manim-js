// GSAP-parity: the Flip plugin's First-Last-Invert-Play technique.
// `flipGetState(targets)` snapshots each target's bounding box + raw geometry
// (the "First" state) BEFORE an instant layout change; the caller then makes
// that change directly (move/resize/reparent the mobjects however it likes);
// `flipFrom(state, targets)` returns an Animation that plays each target from
// its captured "First" state to its now-current "Last" state, so the
// instantaneous jump reads as a smooth glide. See
// examples/gsap-parity/ref/06-flip-transition.md for the GSAP API this mirrors
// (`Flip.getState()` / `Flip.from()`).

import { Animation } from "./Animation.ts";
import type { AnimationConfig } from "./Animation.ts";
import { AnimationGroup } from "./composition.ts";
import type { Mobject } from "../mobject/Mobject.ts";

/** A captured bounding/geometric snapshot of one mobject, taken BEFORE an
 *  instant layout change. Index-aligned with the `targets` array passed to
 *  flipGetState()/flipFrom(). No rotation field: Mobject has no angle/rotation
 *  getter (rotate() only applies directly to points), so there's nothing to
 *  capture -- omitted rather than faked. */
export interface FlipState {
  center: number[];
  width: number;
  height: number;
  /** Deep-cloned raw geometry ([x,y,z] per point) at capture time. */
  points: number[][];
}

/** Capture the CURRENT bounding/geometric state of each mobject (position,
 *  size, raw points). Call this BEFORE an instant layout change. */
export function flipGetState(targets: Mobject[]): FlipState[] {
  return targets.map((m) => ({
    center: [...m.getCenter()],
    width: m.getWidth(),
    height: m.getHeight(),
    points: m.points.map((p) => [p[0], p[1], p[2]]),
  }));
}

export interface FlipFromConfig extends AnimationConfig {
  /** Passed through to the per-target animations and (when >1 target) to the
   *  wrapping AnimationGroup, mirroring TransformMatchingShapes's config reuse. */
  lagRatio?: number;
}

// One target's FLIP interpolation. Modeled on Transform (Animation.ts): begin()
// already sets `startState = mobject.copy()` (the current/"Last" geometry)
// before setup() runs, so setup() overrides it with a "First" snapshot mobject
// built from the captured FlipState, and interpolateMobject() delegates to
// Mobject.interpolate() (points/color/opacity/submobjects blend) exactly like
// Transform does.
class FlipTransform extends Animation {
  firstState: FlipState;
  targetCopy: any;

  constructor(mobject: Mobject, firstState: FlipState, config: AnimationConfig = {}) {
    super(mobject, config);
    this.firstState = firstState;
  }

  setup(): void {
    // "Last": the target's CURRENT geometry -- the layout change already
    // happened by the time flipFrom() is called.
    this.targetCopy = this.mobject.copy();

    const start = this.mobject.copy();
    const captured = this.firstState.points;
    if (captured.length === start.points.length) {
      // Common FLIP case: point count unchanged (pure position/scale/rotation
      // move, the classic "card moves from grid slot to modal" scenario) --
      // use the captured raw geometry directly so the interpolation is exact,
      // not just a bbox approximation.
      start.points = captured.map((p) => [p[0], p[1], p[2]]);
    } else {
      // Structural change: the mobject's point count no longer matches what
      // was captured (shape itself changed, not just moved/resized).
      // Mobject.interpolate() would silently truncate to the shorter array,
      // which reads as points instantly disappearing/appearing rather than a
      // clean glide. Instead fall back to a RIGID bbox-only interpolation:
      // translate+scale a copy of the CURRENT points so their bounding box
      // matches the captured center/width/height. This always keeps the
      // "First" mobject's point count equal to the "Last" mobject's (no
      // truncation), at the documented cost of not reproducing the exact old
      // per-point shape -- only its bounding box.
      const [cx, cy, cz] = this.firstState.center;
      const curCenter = start.getCenter();
      const sx = this.firstState.width / Math.max(1e-12, start.getWidth());
      const sy = this.firstState.height / Math.max(1e-12, start.getHeight());
      start.points = start.points.map((p: number[]) => [
        cx + (p[0] - curCenter[0]) * sx,
        cy + (p[1] - curCenter[1]) * sy,
        cz + (p[2] - curCenter[2]),
      ]);
    }
    this.startState = start;
  }

  interpolateMobject(alpha: number): void {
    this.mobject.interpolate(this.startState, this.targetCopy, alpha);
  }
}

/** Animate FROM a previously-captured state TO each target's CURRENT state.
 *  Call flipGetState() before changing layout, make the instant change, THEN
 *  call flipFrom() -- the targets are already in their "Last" position; this
 *  plays the visual transition so it reads as smooth movement from where they
 *  WERE to where they NOW are. Returns a single Animation (an AnimationGroup
 *  when there's more than one target) suitable for `scene.play(...)`. */
export function flipFrom(
  state: FlipState[],
  targets: Mobject[],
  config: FlipFromConfig = {},
): Animation {
  if (state.length !== targets.length) {
    throw new RangeError(
      `flipFrom: state.length (${state.length}) must match targets.length (${targets.length})`,
    );
  }
  const anims = targets.map((m, i) => new FlipTransform(m, state[i], config));
  if (anims.length === 1) return anims[0];
  return new AnimationGroup(anims, config);
}

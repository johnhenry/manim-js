// A unified keyframe-track primitive. Unlike every other easing tool in this
// codebase (which compile to an opaque pure function), a KeyframeTrack keeps
// its structured, mutable keyframe data around for introspection/editing --
// exactly what a Studio scrub UI needs (splice a keyframe in/out and later
// valueAt() calls reflect it immediately).
//
// Two consumption modes, both provided: PlayKeyframeTrack (an Animation, for
// scene.play()-driven use) and raw .valueAt(t) sampling inside a plain
// addUpdater for lower-ceremony use.

import { Animation } from "./Animation.ts";
import type { AnimationConfig } from "./Animation.ts";
import { running, linear } from "./rate_functions.ts";
import * as V from "../core/math/vector.ts";
import type { RateFunc } from "../core/types.ts";

export interface Keyframe<T> {
  t: number;
  value: T;
  /** Eases the transition ARRIVING at this keyframe (from the previous one).
   *  The first keyframe's own `ease` is unused (nothing transitions into it). */
  ease?: RateFunc | string;
}

export interface KeyframeTrackOptions<T> {
  /** Overrides the inferred duration (default: the last keyframe's `t`). */
  duration?: number;
  /** Custom interpolation, e.g. `Color.lerp` for a color-typed track. Default
   *  dispatch: number/number[] via `V.lerp`, anything else throws naming this
   *  option as the escape hatch. */
  interpolate?: (a: T, b: T, alpha: number) => T;
}

function defaultInterpolate<T>(a: T, b: T, alpha: number): T {
  if (typeof a === "number" || Array.isArray(a)) {
    return V.lerp(a as any, b as any, alpha) as any;
  }
  throw new Error(
    "KeyframeTrack: no default interpolation for this value type; pass " +
    "options.interpolate (e.g. Color.lerp, already used by Mobject.interpolate(), " +
    "for a color-typed track).",
  );
}

export class KeyframeTrack<T = number> {
  keyframes: Keyframe<T>[];
  private _duration?: number;
  private _interpolate: (a: T, b: T, alpha: number) => T;

  constructor(keyframes: Keyframe<T>[], options: KeyframeTrackOptions<T> = {}) {
    this.keyframes = [...keyframes].sort((a, b) => a.t - b.t);
    this._duration = options.duration;
    this._interpolate = options.interpolate ?? defaultInterpolate;
  }

  addKeyframe(kf: Keyframe<T>): this {
    this.keyframes.push(kf);
    this.keyframes.sort((a, b) => a.t - b.t);
    return this;
  }

  /** Removes the keyframe at `index` in the current (sorted) order. */
  removeKeyframe(index: number): this {
    this.keyframes.splice(index, 1);
    return this;
  }

  get duration(): number {
    if (this._duration != null) return this._duration;
    return this.keyframes.length ? this.keyframes[this.keyframes.length - 1].t : 0;
  }

  valueAt(t: number): T {
    const kfs = this.keyframes;
    if (kfs.length === 0) throw new Error("KeyframeTrack.valueAt(): no keyframes");
    if (kfs.length === 1 || t <= kfs[0].t) return kfs[0].value;
    if (t >= kfs[kfs.length - 1].t) return kfs[kfs.length - 1].value;

    let i = 0;
    while (i < kfs.length - 1 && kfs[i + 1].t < t) i++;
    const k0 = kfs[i];
    const k1 = kfs[i + 1];
    const span = k1.t - k0.t || 1e-9;
    const rawAlpha = Math.max(0, Math.min(1, (t - k0.t) / span));
    const ease = k1.ease != null ? running(k1.ease) : linear;
    return this._interpolate(k0.value, k1.value, ease(rawAlpha));
  }
}

/**
 * scene.play()-driven consumption: `apply(mobject, value)` is called every
 * interpolate() with the track's value at that time. Same "preset suggests a
 * duration, explicit config wins" precedence as transitions.ts's
 * springTiming(): `config.runTime` (if given) always wins over the track's
 * own duration.
 *
 * `mobject` may be null (see `animateSignal()` below) -- begin() skips the
 * usual startState snapshot in that case, since nothing here reads it.
 */
export class PlayKeyframeTrack extends Animation {
  track: KeyframeTrack<any>;
  apply: (mobject: any, value: any) => void;

  constructor(
    mobject: any,
    track: KeyframeTrack<any>,
    apply: (mobject: any, value: any) => void,
    config: AnimationConfig = {},
  ) {
    super(mobject, { rateFunc: config.rateFunc ?? linear, ...config, runTime: config.runTime ?? track.duration });
    this.track = track;
    this.apply = apply;
  }

  begin(): this {
    this.started = true;
    if (this.mobject) this.startState = this.mobject.copy();
    this.setup();
    this.interpolate(0);
    return this;
  }

  interpolateMobject(alpha: number): void {
    this.apply(this.mobject, this.track.valueAt(alpha * this.track.duration));
  }
}

/**
 * Convenience wrapper pointing PlayKeyframeTrack's `apply` at a signal's
 * setter, giving "a signal driven by a keyframe timeline" for free -- this
 * also satisfies the separate "wire signals into tweening" idea with no
 * additional mechanism.
 */
export function animateSignal(
  signal: { set: (v: any) => void },
  track: KeyframeTrack<any>,
  config: AnimationConfig = {},
): PlayKeyframeTrack {
  return new PlayKeyframeTrack(null, track, (_mobject, v) => signal.set(v), config);
}

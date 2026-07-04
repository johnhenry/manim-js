// A thin Studio-facing layer over Cluster 2's KeyframeTrack (src/animation/
// keyframe_track.ts): adds absolute-TIME playback state (tick(dt)/seek(t))
// on top of KeyframeTrack's pure alpha-based valueAt(t), and bindTrack()
// wires a track's value onto a mobject property via the EXISTING updater
// machinery -- Scene.updateMobjects(dt) already calls .update(dt) on every
// mobject during both play() and wait(), so no Scene/render changes are
// needed for playback correctness.
//
// tick()/seek() must agree exactly for the same absolute time: tick()
// accumulates dt into `time` then delegates to the identical valueAt(time)
// seek() calls directly, so authoring playback (many small tick(dt) calls)
// and a Studio scrub (one seek(t) jump) can never drift apart.

import { KeyframeTrack } from "../animation/keyframe_track.ts";
import type { Keyframe, KeyframeTrackOptions } from "../animation/keyframe_track.ts";
import type { Mobject, Updater } from "../mobject/Mobject.ts";

export class PlayableKeyframeTrack<T = number> extends KeyframeTrack<T> {
  time = 0;

  /** Advance by `dt` seconds and return the value at the new time. */
  tick(dt: number): T {
    this.time += dt;
    return this.valueAt(this.time);
  }

  /** Jump directly to an absolute time (a Studio scrub) and return its value. */
  seek(t: number): T {
    this.time = t;
    return this.valueAt(t);
  }
}

/**
 * Bind a track's value onto `mobject[prop]` every update(dt) tick, via the
 * mobject's own updater list (the same mechanism addUpdater()/alwaysRedraw()
 * already use). Returns the Updater so the caller can removeUpdater() it.
 */
export function bindTrack(mobject: Mobject, prop: string, track: PlayableKeyframeTrack<any>): Updater {
  const fn: Updater = (m: any, dt: number) => {
    m[prop] = track.tick(dt);
  };
  mobject.addUpdater(fn);
  return fn;
}

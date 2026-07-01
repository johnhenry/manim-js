// "Changing" mobjects mirroring ManimCommunity manim/animation/changing.py.
// These are VMobjects that update themselves each frame via addUpdater: an
// AnimatedBoundary traces a mobject's outline, and TracedPath records the path
// of a moving point over time.

import { VMobject, VGroup } from "../mobject/VMobject.ts";
import { Color } from "../core/color.ts";
import * as V from "../core/math/vector.ts";
import type { Mobject } from "../mobject/Mobject.ts";
import type { ColorLike } from "../core/types.ts";

/** Config for AnimatedBoundary. */
export interface AnimatedBoundaryConfig {
  colors?: ColorLike[];
  maxTipLengthToLengthRatio?: number;
  cycleRate?: number;
  strokeWidth?: number;
}

/**
 * AnimatedBoundary: a VGroup of two moving partial copies of `vmobject`'s
 * outline that cycle through `colors`, giving the impression of an animated
 * boundary being drawn continuously. An updater advances the boundary each
 * frame based on accumulated time and `cycleRate`.
 */
export class AnimatedBoundary extends VGroup {
  vmobject: any;
  colors: Color[];
  maxTipLengthToLengthRatio: number;
  cycleRate: number;
  boundaryStrokeWidth: number;
  totalTime: number;
  boundaryCopies: VMobject[];

  constructor(vmobject: Mobject, config: AnimatedBoundaryConfig = {}) {
    super();
    this.vmobject = vmobject;
    this.colors = (config.colors ?? ["#29ABCA", "#9CDCEB", "#236B8E", "#82C91E"]).map((c) => Color.parse(c));
    this.maxTipLengthToLengthRatio = config.maxTipLengthToLengthRatio ?? 0.5;
    this.cycleRate = config.cycleRate ?? 0.5;
    this.boundaryStrokeWidth = config.strokeWidth ?? 4;
    this.totalTime = 0;

    // Two boundary copies that sweep opposite portions of the outline.
    this.boundaryCopies = [0, 1].map(() => {
      const c = new VMobject();
      c.strokeWidth = this.boundaryStrokeWidth;
      c.fillOpacity = 0;
      return c;
    });
    this.add(...this.boundaryCopies);

    this.addUpdater((_m: Mobject, dt: number) => this.updateBoundary(dt));
    // Draw the initial frame.
    this.updateBoundary(0);
  }

  private updateBoundary(dt: number): void {
    this.totalTime += dt;
    const cycle = this.cycleRate * this.totalTime;
    // Which color of the cycle we are on, and how far into the current stroke.
    const index = Math.floor(cycle) % this.colors.length;
    const frac = cycle - Math.floor(cycle);
    const [growing, fading] = this.boundaryCopies;

    // Growing copy: [0, frac] of the outline, in the current color.
    growing.pointwiseBecomePartial(this.vmobject, 0, Math.max(1e-6, frac));
    growing.strokeColor = this.colors[index];
    growing.strokeWidth = this.boundaryStrokeWidth;
    growing.fillOpacity = 0;

    // Fading copy: [frac, 1] of the outline, in the previous color.
    const prevIndex = (index + this.colors.length - 1) % this.colors.length;
    fading.pointwiseBecomePartial(this.vmobject, Math.min(1 - 1e-6, frac), 1);
    fading.strokeColor = this.colors[prevIndex];
    fading.strokeWidth = this.boundaryStrokeWidth;
    fading.fillOpacity = 0;
  }
}

// A traced-point function returns the current point to append to the path.
export type TracedPointFunc = () => number[];

/** Config for TracedPath. */
export interface TracedPathConfig {
  strokeWidth?: number;
  strokeColor?: ColorLike;
  dissipatingTime?: number | null;
}

/**
 * TracedPath: a VMobject that appends `tracedPointFunc()` each frame, tracing
 * the path of a moving point. When `dissipatingTime` is set, points older than
 * that many seconds are dropped, so the trail fades from the tail.
 */
export class TracedPath extends VMobject {
  tracedPointFunc: TracedPointFunc;
  dissipatingTime: number | null;
  traceTime: number;
  private _times: number[];

  constructor(tracedPointFunc: TracedPointFunc, config: TracedPathConfig = {}) {
    super({
      strokeWidth: config.strokeWidth ?? 2,
      strokeColor: config.strokeColor ?? "#FFFFFF",
      fillOpacity: 0,
    });
    this.tracedPointFunc = tracedPointFunc;
    this.dissipatingTime = config.dissipatingTime ?? null;
    this.traceTime = 0;
    this._times = [];
    this.points = [];
    this.subpathStarts = [];
    this.addUpdater((_m: Mobject, dt: number) => this.updatePath(dt));
  }

  private updatePath(dt: number): void {
    this.traceTime += dt;
    const point = this.tracedPointFunc();
    const p: number[] = [point[0], point[1] ?? 0, point[2] ?? 0];

    if (this.points.length === 0) {
      this.startNewPath(p);
      this._times.push(this.traceTime);
    } else {
      this.addLineTo(p);
      this._times.push(this.traceTime);
    }

    // Dissipation: drop the oldest anchors whose age exceeds dissipatingTime.
    if (this.dissipatingTime != null) {
      const cutoff = this.traceTime - this.dissipatingTime;
      let drop = 0;
      while (drop < this._times.length && this._times[drop] < cutoff) drop++;
      if (drop > 0) {
        this._times.splice(0, drop);
        // Each appended anchor after the first added 3 points (a cubic segment).
        // Drop `drop` anchors' worth of leading points, then re-anchor the path.
        this.points.splice(0, drop * 3);
        if (this.points.length > 0) this.subpathStarts = [0];
        else this.subpathStarts = [];
      }
    }
  }
}

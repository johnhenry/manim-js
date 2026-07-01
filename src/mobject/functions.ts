// Standalone function-graph mobjects, mirroring ManimCommunity
// manim/mobject/graphing/functions.py. These are graphed in ABSOLUTE
// coordinates (not tied to an Axes) — like manim's ParametricFunction,
// FunctionGraph and ImplicitFunction.

import { VMobject } from "./VMobject.ts";
import type { VMobjectConfig } from "./VMobject.ts";
import * as V from "../core/math/vector.ts";

// manim's config.frame_x_radius (frame_width 14.222.../2). Used as the default
// half-width for FunctionGraph's x_range when none is supplied.
const FRAME_X_RADIUS = 7.111111111111111;

/** A scaling applied to sampled t values / output points (manim's _ScaleBase). */
export interface ScalingFunction {
  function: (value: number) => number;
}

/** t -> [x, y] or [x, y, z]. */
export type ParametricFn = (t: number) => number[];

/** (x, y) -> number; the zero set is plotted by ImplicitFunction. */
export type ImplicitFn = (x: number, y: number) => number;

export interface ParametricFunctionConfig extends VMobjectConfig {
  /** [tMin, tMax, tStep]; tStep defaults to 0.01 when omitted. */
  tRange?: number[];
  /** Optional scaling applied to the t values before evaluation. */
  scaling?: ScalingFunction;
  /** Build a smooth spline (true) or straight corners (false). */
  useSmoothing?: boolean;
  /** t values at which the curve is broken into separate subpaths. */
  discontinuities?: number[];
  /** Step used to detect discontinuities around the given t values. */
  dtForDerivative?: number;
}

/** Ensure a sampled point is a [x, y, z] triple. */
function toPoint3(p: number[]): number[] {
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0];
}

/**
 * ParametricFunction — samples fn(t) across tRange and builds a VMobject curve.
 * Handles discontinuities by splitting the sampled range into separate
 * subpaths around each discontinuity.
 */
export class ParametricFunction extends VMobject {
  function: ParametricFn;
  tRange: number[];
  scaling?: ScalingFunction;
  useSmoothing: boolean;
  discontinuities: number[];
  dtForDerivative: number;

  constructor(fn: ParametricFn, config: ParametricFunctionConfig = {}) {
    super(config);
    this.function = fn;
    const range = config.tRange ?? [0, 1, 0.01];
    // Normalize to [tMin, tMax, tStep].
    this.tRange = [
      range[0] ?? 0,
      range[1] ?? 1,
      range[2] ?? 0.01,
    ];
    this.scaling = config.scaling;
    this.useSmoothing = config.useSmoothing ?? true;
    this.discontinuities = config.discontinuities ?? [];
    this.dtForDerivative = config.dtForDerivative ?? 1e-6;

    this.generatePoints();
  }

  /** Evaluate the underlying function at t, applying scaling if present. */
  getPoint(t: number): number[] {
    const tv = this.scaling ? this.scaling.function(t) : t;
    return toPoint3(this.function(tv));
  }

  getFunction(): ParametricFn {
    return this.function;
  }

  /** Build the list of t values for one contiguous [start, end] subrange. */
  private tValues(start: number, end: number, step: number): number[] {
    const ts: number[] = [];
    if (step <= 0) {
      ts.push(start, end);
      return ts;
    }
    // Inclusive of the endpoint (mirrors numpy arange + explicit end append).
    const n = Math.floor((end - start) / step + 1e-9);
    for (let i = 0; i <= n; i++) ts.push(start + i * step);
    const last = ts[ts.length - 1];
    if (last === undefined || Math.abs(last - end) > 1e-9) ts.push(end);
    return ts;
  }

  /** Sample the function and populate this VMobject's points / subpaths. */
  protected generatePoints(): this {
    const [tMin, tMax, tStep] = this.tRange;
    const step = tStep || 0.01;

    // Split the full range at each discontinuity that lies strictly inside it.
    const dt = this.dtForDerivative;
    const disc = this.discontinuities
      .filter((d) => d > tMin && d < tMax)
      .sort((a, b) => a - b);

    // Build the boundaries of the contiguous subranges.
    const boundaries: Array<[number, number]> = [];
    let segStart = tMin;
    for (const d of disc) {
      const before = d - dt;
      if (before > segStart) boundaries.push([segStart, before]);
      segStart = d + dt;
    }
    if (segStart < tMax) boundaries.push([segStart, tMax]);
    if (boundaries.length === 0) boundaries.push([tMin, tMax]);

    // Reset the geometry, then append each subrange as its own subpath.
    this.points = [];
    this.subpathStarts = [];

    let first = true;
    for (const [a, b] of boundaries) {
      const ts = this.tValues(a, b, step);
      const anchors: number[][] = [];
      for (const t of ts) {
        const p = this.getPoint(t);
        if (p.every(Number.isFinite)) anchors.push(p);
      }
      if (anchors.length === 0) continue;

      if (first && boundaries.length === 1) {
        // Single subpath: build directly with the whole-VMobject helpers.
        if (this.useSmoothing) this.setPointsSmoothly(anchors);
        else this.setPointsAsCorners(anchors);
      } else {
        // Multiple subpaths: build each independently then merge its points.
        const tmp = new VMobject();
        if (this.useSmoothing) tmp.setPointsSmoothly(anchors);
        else tmp.setPointsAsCorners(anchors);
        this.subpathStarts.push(this.points.length);
        for (const p of tmp.points) this.points.push(V.clone(p));
      }
      first = false;
    }
    if (this.subpathStarts.length === 0) this.subpathStarts = [0];
    return this;
  }
}

export interface FunctionGraphConfig extends ParametricFunctionConfig {
  /** [xMin, xMax] (optional xStep as third element). */
  xRange?: number[];
}

/**
 * FunctionGraph — a ParametricFunction specialization for y = f(x), i.e.
 * t -> [t, f(t)]. Stores the underlying scalar function for Axes-style helpers.
 */
export class FunctionGraph extends ParametricFunction {
  underlyingFunction: (x: number) => number;
  xRange: number[];

  constructor(fn: (x: number) => number, config: FunctionGraphConfig = {}) {
    const xRange = config.xRange ?? [-FRAME_X_RADIUS, FRAME_X_RADIUS];
    const tRange = [
      xRange[0],
      xRange[1],
      xRange[2] ?? config.tRange?.[2] ?? 0.01,
    ];
    super((t: number) => [t, fn(t), 0], { ...config, tRange });
    this.underlyingFunction = fn;
    this.xRange = xRange;
  }

  /** The [x, f(x), 0] point at a given x. */
  getPointFromFunction(x: number): number[] {
    return [x, this.underlyingFunction(x), 0];
  }
}

export interface ImplicitFunctionConfig extends VMobjectConfig {
  /** [xMin, xMax] sampling bounds. */
  xRange?: number[];
  /** [yMin, yMax] sampling bounds. */
  yRange?: number[];
  /** Minimum grid subdivision depth. */
  minDepth?: number;
  /** Maximum number of quads along each axis. */
  maxQuads?: number;
  /** Whether to smooth the resulting contour. */
  useSmoothing?: boolean;
}

/**
 * ImplicitFunction — plots fn(x, y) = 0 via marching squares over a grid,
 * building the zero-contour as one or more subpaths.
 */
export class ImplicitFunction extends VMobject {
  function: ImplicitFn;
  xRange: number[];
  yRange: number[];
  minDepth: number;
  maxQuads: number;
  useSmoothing: boolean;

  constructor(fn: ImplicitFn, config: ImplicitFunctionConfig = {}) {
    super(config);
    this.function = fn;
    this.xRange = config.xRange ?? [-FRAME_X_RADIUS, FRAME_X_RADIUS];
    this.yRange = config.yRange ?? [-FRAME_X_RADIUS, FRAME_X_RADIUS];
    this.minDepth = config.minDepth ?? 5;
    this.maxQuads = config.maxQuads ?? 1500;
    this.useSmoothing = config.useSmoothing ?? false;
    this.generatePoints();
  }

  /** Linear interpolation of the zero-crossing between two grid values. */
  private zeroCrossing(
    ax: number, ay: number, av: number,
    bx: number, by: number, bv: number,
  ): number[] {
    const denom = av - bv;
    const t = denom === 0 ? 0.5 : av / denom;
    return [ax + (bx - ax) * t, ay + (by - ay) * t, 0];
  }

  /** Marching squares over the grid; emit line segments per cell. */
  protected generatePoints(): this {
    const [xMin, xMax] = this.xRange;
    const [yMin, yMax] = this.yRange;

    // Grid resolution derived from minDepth, clamped by maxQuads.
    const requested = Math.max(4, Math.floor(Math.pow(2, this.minDepth)));
    const perAxisCap = Math.max(4, Math.floor(Math.sqrt(this.maxQuads)));
    const nx = Math.min(requested, perAxisCap);
    const ny = nx;

    const dx = (xMax - xMin) / nx;
    const dy = (yMax - yMin) / ny;

    // Precompute the sampled scalar field.
    const values: number[][] = [];
    for (let j = 0; j <= ny; j++) {
      const row: number[] = [];
      const y = yMin + j * dy;
      for (let i = 0; i <= nx; i++) {
        const x = xMin + i * dx;
        row.push(this.function(x, y));
      }
      values.push(row);
    }

    // Collect line segments from each cell via marching squares.
    const segments: number[][][] = [];
    for (let j = 0; j < ny; j++) {
      const y0 = yMin + j * dy;
      const y1 = y0 + dy;
      for (let i = 0; i < nx; i++) {
        const x0 = xMin + i * dx;
        const x1 = x0 + dx;
        // Corner values: bottom-left, bottom-right, top-right, top-left.
        const v0 = values[j][i];
        const v1 = values[j][i + 1];
        const v2 = values[j + 1][i + 1];
        const v3 = values[j + 1][i];
        if (![v0, v1, v2, v3].every(Number.isFinite)) continue;

        let idx = 0;
        if (v0 > 0) idx |= 1;
        if (v1 > 0) idx |= 2;
        if (v2 > 0) idx |= 4;
        if (v3 > 0) idx |= 8;
        if (idx === 0 || idx === 15) continue; // no crossing

        // Edge zero-crossings (bottom, right, top, left).
        const eBottom = () => this.zeroCrossing(x0, y0, v0, x1, y0, v1);
        const eRight = () => this.zeroCrossing(x1, y0, v1, x1, y1, v2);
        const eTop = () => this.zeroCrossing(x1, y1, v2, x0, y1, v3);
        const eLeft = () => this.zeroCrossing(x0, y1, v3, x0, y0, v0);

        const push = (a: number[], b: number[]) => segments.push([a, b]);

        switch (idx) {
          case 1: case 14: push(eLeft(), eBottom()); break;
          case 2: case 13: push(eBottom(), eRight()); break;
          case 3: case 12: push(eLeft(), eRight()); break;
          case 4: case 11: push(eRight(), eTop()); break;
          case 6: case 9: push(eBottom(), eTop()); break;
          case 7: case 8: push(eLeft(), eTop()); break;
          case 5: // saddle: two segments
            push(eLeft(), eBottom());
            push(eRight(), eTop());
            break;
          case 10: // saddle: two segments
            push(eBottom(), eRight());
            push(eLeft(), eTop());
            break;
        }
      }
    }

    // Stitch segments into connected polylines (subpaths) by matching endpoints.
    const paths = this.stitch(segments);

    this.points = [];
    this.subpathStarts = [];
    if (paths.length === 0) {
      this.subpathStarts = [0];
      return this;
    }
    for (const path of paths) {
      if (path.length < 2) continue;
      const tmp = new VMobject();
      if (this.useSmoothing) tmp.setPointsSmoothly(path);
      else tmp.setPointsAsCorners(path);
      this.subpathStarts.push(this.points.length);
      for (const p of tmp.points) this.points.push(V.clone(p));
    }
    if (this.subpathStarts.length === 0) this.subpathStarts = [0];
    return this;
  }

  /** Greedily chain segments whose endpoints coincide into polylines. */
  private stitch(segments: number[][][]): number[][][] {
    const eps = 1e-6;
    const same = (a: number[], b: number[]) =>
      Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;

    const used = new Array(segments.length).fill(false);
    const paths: number[][][] = [];

    for (let s = 0; s < segments.length; s++) {
      if (used[s]) continue;
      used[s] = true;
      const path: number[][] = [segments[s][0], segments[s][1]];

      // Extend forward.
      let extended = true;
      while (extended) {
        extended = false;
        const tail = path[path.length - 1];
        for (let k = 0; k < segments.length; k++) {
          if (used[k]) continue;
          const [a, b] = segments[k];
          if (same(a, tail)) { path.push(b); used[k] = true; extended = true; break; }
          if (same(b, tail)) { path.push(a); used[k] = true; extended = true; break; }
        }
      }
      // Extend backward.
      extended = true;
      while (extended) {
        extended = false;
        const head = path[0];
        for (let k = 0; k < segments.length; k++) {
          if (used[k]) continue;
          const [a, b] = segments[k];
          if (same(b, head)) { path.unshift(a); used[k] = true; extended = true; break; }
          if (same(a, head)) { path.unshift(b); used[k] = true; extended = true; break; }
        }
      }
      paths.push(path);
    }
    return paths;
  }
}

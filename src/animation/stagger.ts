// Composable stagger value-transform helpers, usable inline with
// LaggedStartMap's (m, index, total) factory signature or the `.animate`
// builder. Deliberately NOT a generic property-string DSL (mobject.set(name,
// value)) -- no such dispatcher exists on Mobject to build on top of.

import { mulberry32 } from "../core/noise.ts";

/** Index-safe (negative-safe modulo) cycling through a fixed list of values,
 *  mo.js's property-map ergonomic: `cycle(["red", "blue", "green"])`. */
export function cycle<T>(values: readonly T[]): (m: any, index: number, total: number) => T {
  if (values.length === 0) throw new RangeError("cycle() requires at least one value");
  return (_m: any, index: number) => {
    const i = ((index % values.length) + values.length) % values.length;
    return values[i];
  };
}

/** Linear distribution by index across `[from, to]`, anime.js's `modifier`
 *  ergonomic: `staggerRange(0, 1)` gives each of `total` items an even step. */
export function staggerRange(from: number, to: number): (m: any, index: number, total: number) => number {
  return (_m: any, index: number, total: number) => {
    if (total <= 1) return from;
    const t = index / (total - 1);
    return from + (to - from) * t;
  };
}

export interface StaggerGridOptions {
  /** [rows, cols] grid shape the flat mobject list represents. */
  grid: [number, number];
  /** Distribution origin (default "start"). "random" is deterministic
   *  (seeded by index), not JS's Math.random -- see staggerGrid's doc. */
  from?: "start" | "center" | "end" | "edges" | "random" | number | [number, number];
  /** Restrict distance computation to one axis (default: both, Euclidean). */
  axis?: "x" | "y";
  /** Per-step delay unit, GSAP's `stagger.each` ergonomic (default 1). Each
   *  item's distance-from-origin is normalized to [0, 1] across the grid,
   *  then scaled by `each` to produce the returned delay. */
  each?: number;
}

/** GSAP-style grid-aware stagger delay: treats a flat mobject list as a
 *  `grid` [rows,cols] layout and returns each item's delay based on its
 *  distance from `from`'s origin cell -- "center"/"edges" ripple
 *  outward/inward spatially (true 2D proximity, not array-index order),
 *  matching GSAP's `stagger.grid`+`from` semantics. `from: "random"` is
 *  deterministic (mulberry32 seeded by index) so it stays cache-safe under
 *  scrubbing, same convention as expressions.ts's seeded noise. Directly
 *  usable like staggerRange (not a two-stage builder) -- feed straight into
 *  LaggedStartMap's (m,index,total)=>delay factory slot. */
export function staggerGrid(options: StaggerGridOptions): (m: any, index: number, total: number) => number {
  const [rows, cols] = options.grid;
  const from = options.from ?? "start";
  const axis = options.axis;
  const each = options.each ?? 1;
  const n = rows * cols;

  const cellOf = (i: number): [number, number] => [Math.floor(i / cols), i % cols];
  const distance = (r: number, c: number, r0: number, c0: number): number => {
    const dr = r - r0;
    const dc = c - c0;
    if (axis === "x") return Math.abs(dc);
    if (axis === "y") return Math.abs(dr);
    return Math.hypot(dr, dc);
  };

  // Precompute one normalized (0..1) delay per grid cell, up front -- pure of
  // `index` (order-independent), so "random" stays deterministic/cache-safe.
  let delays: number[];
  if (from === "random") {
    delays = Array.from({ length: n }, (_, i) => mulberry32(i + 1)());
  } else {
    let originR: number;
    let originC: number;
    let invert = false;
    if (from === "end") {
      originR = rows - 1;
      originC = cols - 1;
    } else if (from === "center") {
      originR = (rows - 1) / 2;
      originC = (cols - 1) / 2;
    } else if (from === "edges") {
      originR = (rows - 1) / 2;
      originC = (cols - 1) / 2;
      invert = true;
    } else if (typeof from === "number") {
      [originR, originC] = cellOf(from);
    } else if (Array.isArray(from)) {
      [originR, originC] = from;
    } else {
      // "start"
      originR = 0;
      originC = 0;
    }
    const raw = Array.from({ length: n }, (_, i) => {
      const [r, c] = cellOf(i);
      return distance(r, c, originR, originC);
    });
    const maxRaw = Math.max(...raw, 1e-12);
    const base = invert ? raw.map((d) => maxRaw - d) : raw;
    const maxBase = Math.max(...base, 1e-12);
    delays = base.map((d) => d / maxBase);
  }

  return (_m: any, index: number, _total: number) => {
    const i = ((index % n) + n) % n;
    return delays[i] * each;
  };
}

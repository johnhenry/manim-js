// Shared type aliases used across the library.

/** A 3D point or vector, matching manim's numpy points of shape (3,). */
export type Vec3 = [number, number, number];

/** Anything acceptable as a color: a hex string, an [r,g,b(,a)] array, or a Color. */
export type ColorLike = string | number[] | { r: number; g: number; b: number; a?: number };

/** A rate function maps animation progress t in [0,1] to eased progress. */
export type RateFunc = (t: number) => number;

/** A parametric surface function (u, v) -> point. */
export type SurfaceFunc = (u: number, v: number) => Vec3 | number[];

/** A plain 2D drawing context (the subset the renderers use). */
export type Ctx2D = CanvasRenderingContext2D;

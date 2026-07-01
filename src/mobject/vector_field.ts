// Vector field mobjects: VectorField (base), ArrowVectorField and StreamLines.
// Ports of ManimCommunity manim/mobject/vector_field.py.
//
// A field function `func` maps a point [x, y, z] to a vector [vx, vy, vz]. The
// arrow field samples the function on a grid, drawing one arrow per sample,
// scaled and colored by magnitude. Stream lines integrate the field from seed
// points to trace flow paths.

import { VMobject, VGroup } from "./VMobject.ts";
import * as V from "../core/math/vector.ts";
import { Arrow } from "./geometry.ts";
import { Vector } from "./vectors.ts";
import { Color, BLUE_E, GREEN, YELLOW, RED } from "../core/color.ts";
import type { ColorLike, Vec3 } from "../core/types.ts";

type FieldFunc = (point: any) => number[];

// Default magnitude color ramp (low -> high).
const DEFAULT_COLORS: ColorLike[] = [BLUE_E, GREEN, YELLOW, RED];

// Interpolate a color from a ramp based on a normalized value in [0, 1].
function colorFromRamp(colors: ColorLike[], alpha: number): Color {
  if (colors.length === 0) return Color.parse("#FFFFFF");
  if (colors.length === 1) return Color.parse(colors[0]);
  const a = Math.max(0, Math.min(1, alpha));
  const scaled = a * (colors.length - 1);
  const lo = Math.floor(scaled);
  const hi = Math.min(colors.length - 1, lo + 1);
  return Color.lerp(colors[lo], colors[hi], scaled - lo);
}

export interface VectorFieldConfig {
  colorScheme?: (point: number[]) => number; // maps point -> scalar to color by
  minColorScheme?: number;
  maxColorScheme?: number;
  colors?: ColorLike[];
  [key: string]: any;
}

export class VectorField extends VGroup {
  func: FieldFunc;
  colors: ColorLike[];
  minColorScheme: number;
  maxColorScheme: number;
  colorScheme: (point: number[]) => number;

  constructor(funcXY: FieldFunc, config: VectorFieldConfig = {}) {
    super();
    // Normalize the field function to always accept/return a 3-vector.
    this.func = (point: any): Vec3 => {
      const p = point as number[];
      const out = funcXY([p[0], p[1] ?? 0, p[2] ?? 0]);
      return [out[0] ?? 0, out[1] ?? 0, out[2] ?? 0];
    };
    this.colors = config.colors ?? DEFAULT_COLORS;
    // By default color by vector magnitude at a point.
    this.colorScheme = config.colorScheme ?? ((p: number[]) => V.length(this.func(p)));
    this.minColorScheme = config.minColorScheme ?? 0;
    this.maxColorScheme = config.maxColorScheme ?? 2;
  }

  // Normalize a scalar value into [0, 1] across the color scheme range.
  protected normalizeScalar(value: number): number {
    const lo = this.minColorScheme;
    const hi = this.maxColorScheme;
    if (hi === lo) return 0;
    return (value - lo) / (hi - lo);
  }

  colorForPoint(point: number[]): Color {
    return colorFromRamp(this.colors, this.normalizeScalar(this.colorScheme(point)));
  }

  // Build a single colored arrow representing the field at `point`.
  getVector(point: number[]): Vector {
    const p: Vec3 = [point[0], point[1] ?? 0, point[2] ?? 0];
    const v = this.func(p);
    const color = this.colorForPoint(p).toHex();
    const vec = new Vector(v, { color, strokeColor: color });
    vec.shift(V.sub(p, vec.getStart()));
    return vec;
  }
}

export interface ArrowVectorFieldConfig extends VectorFieldConfig {
  xRange?: number[];
  yRange?: number[];
  step?: number;
  lengthFunc?: (norm: number) => number;
  minColor?: ColorLike;
  maxColor?: ColorLike;
  strokeWidth?: number;
  vectorConfig?: Record<string, any>;
  [key: string]: any;
}

// Saturating length function: long vectors are compressed so the field stays
// readable. Mirrors manim's default (arctan-based scaling).
function defaultLengthFunc(norm: number): number {
  return 0.45 * Math.sqrt(2) * (2 / Math.PI) * Math.atan(norm);
}

export class ArrowVectorField extends VectorField {
  xRange: number[];
  yRange: number[];
  step: number;
  lengthFunc: (norm: number) => number;

  constructor(func: FieldFunc, config: ArrowVectorFieldConfig = {}) {
    // Merge minColor/maxColor into a color ramp if provided.
    let colors = config.colors;
    if (!colors && (config.minColor || config.maxColor)) {
      colors = [config.minColor ?? BLUE_E, config.maxColor ?? RED];
    }
    super(func, { ...config, colors });

    this.step = config.step ?? 0.5;
    this.xRange = config.xRange ?? [-3, 3, this.step];
    this.yRange = config.yRange ?? [-3, 3, this.step];
    // Ensure a step component in each range.
    if (this.xRange[2] == null) this.xRange = [this.xRange[0], this.xRange[1], this.step];
    if (this.yRange[2] == null) this.yRange = [this.yRange[0], this.yRange[1], this.step];
    this.lengthFunc = config.lengthFunc ?? defaultLengthFunc;

    this._buildArrows(config);
  }

  private _buildArrows(config: ArrowVectorFieldConfig): void {
    const [x0, x1, dx] = this.xRange;
    const [y0, y1, dy] = this.yRange;
    const eps = 1e-9;
    for (let x = x0; x <= x1 + eps; x += dx) {
      for (let y = y0; y <= y1 + eps; y += dy) {
        const point: Vec3 = [x, y, 0];
        const v = this.func(point);
        const norm = V.length(v);
        const color = this.colorForPoint(point).toHex();

        // Scale the drawn vector length via the saturating length function.
        let drawn: Vec3;
        if (norm < eps) {
          drawn = [0, 0, 0];
        } else {
          const targetLen = this.lengthFunc(norm);
          drawn = V.scale(V.normalize(v), targetLen);
        }
        const end: Vec3 = [x + drawn[0], y + drawn[1], drawn[2]];

        const arrow = new Arrow(point, end, {
          color,
          strokeColor: color,
          buff: 0,
          strokeWidth: config.strokeWidth ?? 2,
          tipLength: Math.min(0.2, this.step * 0.4),
          ...(config.vectorConfig ?? {}),
        });
        (arrow as any).fieldPoint = point;
        (arrow as any).fieldVector = v;
        this.add(arrow);
      }
    }
  }
}

export interface StreamLinesConfig extends VectorFieldConfig {
  xRange?: number[];
  yRange?: number[];
  step?: number;
  strokeWidth?: number;
  maxAnchorsPerLine?: number;
  dt?: number;
  virtualTime?: number;
  nRepeats?: number;
  noisePad?: number;
  [key: string]: any;
}

export class StreamLines extends VectorField {
  xRange: number[];
  yRange: number[];
  step: number;
  declare strokeWidth: number;
  maxAnchorsPerLine: number;
  dt: number;
  virtualTime: number;
  nRepeats: number;
  streamLines: VMobject[];

  constructor(func: FieldFunc, config: StreamLinesConfig = {}) {
    super(func, config);

    this.step = config.step ?? 0.5;
    this.xRange = config.xRange ?? [-3, 3, this.step];
    this.yRange = config.yRange ?? [-3, 3, this.step];
    if (this.xRange[2] == null) this.xRange = [this.xRange[0], this.xRange[1], this.step];
    if (this.yRange[2] == null) this.yRange = [this.yRange[0], this.yRange[1], this.step];
    this.strokeWidth = config.strokeWidth ?? 1;
    this.maxAnchorsPerLine = config.maxAnchorsPerLine ?? 100;
    this.dt = config.dt ?? 0.05;
    this.virtualTime = config.virtualTime ?? 3;
    this.nRepeats = config.nRepeats ?? 1;
    this.streamLines = [];

    this._buildLines();
  }

  // Integrate the field with 4th-order Runge-Kutta to advance a point.
  private _rk4Step(p: Vec3, dt: number): Vec3 {
    const f = (q: Vec3): Vec3 => this.func(q) as Vec3;
    const k1 = f(p);
    const k2 = f(V.add(p, V.scale(k1, dt / 2)) as Vec3);
    const k3 = f(V.add(p, V.scale(k2, dt / 2)) as Vec3);
    const k4 = f(V.add(p, V.scale(k3, dt)) as Vec3);
    const incr = V.scale(
      [
        k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0],
        k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1],
        k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2],
      ],
      dt / 6,
    );
    return V.add(p, incr) as Vec3;
  }

  private _buildLines(): void {
    const [x0, x1, dx] = this.xRange;
    const [y0, y1, dy] = this.yRange;
    const eps = 1e-9;
    const nSteps = Math.max(1, Math.floor(this.virtualTime / this.dt));

    for (let rep = 0; rep < this.nRepeats; rep++) {
      for (let x = x0; x <= x1 + eps; x += dx) {
        for (let y = y0; y <= y1 + eps; y += dy) {
          const anchors: Vec3[] = [];
          let p: Vec3 = [x, y, 0];
          anchors.push(V.clone(p));

          for (let s = 0; s < nSteps && anchors.length < this.maxAnchorsPerLine; s++) {
            const next = this._rk4Step(p, this.dt);
            if (!Number.isFinite(next[0]) || !Number.isFinite(next[1]) || !Number.isFinite(next[2])) {
              break;
            }
            // Stop if the point escapes far past the domain.
            if (next[0] < x0 - 5 || next[0] > x1 + 5 || next[1] < y0 - 5 || next[1] > y1 + 5) {
              anchors.push(V.clone(next));
              break;
            }
            p = next;
            anchors.push(V.clone(p));
          }

          if (anchors.length < 2) continue;

          const line = new VMobject({ strokeWidth: this.strokeWidth });
          line.setPointsAsCorners(anchors);
          line.fillOpacity = 0;
          this._colorLineByLength(line, anchors);
          (line as any).seedPoint = [x, y, 0];
          this.streamLines.push(line);
          this.add(line);
        }
      }
    }
  }

  // Color the polyline: use the average field magnitude along its anchors so
  // each line reads as a single magnitude-mapped hue (finite, stable).
  private _colorLineByLength(line: VMobject, anchors: Vec3[]): void {
    let total = 0;
    for (const a of anchors) total += V.length(this.func(a));
    const avg = anchors.length ? total / anchors.length : 0;
    const color = colorFromRamp(this.colors, this.normalizeScalar(avg));
    line.strokeColor = color;
    (line as any).color = color;
  }

  getLines(): VMobject[] {
    return this.streamLines;
  }

  // Static build is the deliverable; these are lightweight stubs so callers can
  // treat StreamLines like an animatable object without a running scene.
  create(): this {
    return this;
  }

  startAnimation(): this {
    return this;
  }

  endAnimation(): this {
    return this;
  }
}

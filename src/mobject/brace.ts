// Brace mobjects: a curly-brace VMobject spanning a mobject's extent in a given
// direction, with helpers for attaching a text/tex label at the brace tip.
// Ported (shape-approximated) from ManimCommunity's manim/mobject/svg/brace.py.
// Rather than rendering a LaTeX \underbrace glyph, the brace outline is built
// directly from bezier/corner points: two half-spans meeting at a central tip.

import { VMobject, VGroup } from "./VMobject.ts";
import { Mobject, Group } from "./Mobject.ts";
import { Text } from "./text/Text.ts";
import { MathTex } from "./mathtex.ts";
import * as V from "../core/math/vector.ts";

/** Configuration for a Brace. */
export interface BraceConfig {
  direction?: number[];
  buff?: number;
  sharpness?: number;
  strokeColor?: any;
  fillColor?: any;
  color?: any;
  [key: string]: any;
}

const DEFAULT_BUFF = 0.2;
// Depth of the brace measured perpendicular to its span.
const BRACE_HEIGHT = 0.32;
// Cubic approximation constant for a quarter arc.
const K = 0.5523;

// Build a curly-brace CENTERLINE spanning `width` centered at the origin,
// opening downward (tip at -height): each half is [end-curl quarter arc] +
// [straight run] + [quarter arc into the tip]. Stroked, not filled — crisp
// at any span (the old hand-sketched filled band rendered as a wobble).
function braceCenterline(vm: VMobject, width: number, height: number): void {
  const w = Math.max(width, 0.01);
  const half = w / 2;
  const q = height / 2;
  const run = Math.max(half - 2 * q, 0); // straight-run half-length
  vm.points = [];
  vm.subpathStarts = [];

  const halfPath = (sign: 1 | -1): number[][] => {
    // From the outer end (sign*half, 0) curling to depth -q, running inward,
    // then curving down into the tip (0, -2q).
    const x0 = sign * half;
    const x1 = sign * (half - q);
    const x2 = sign * q;
    return [
      [x0, 0, 0],
      // quarter arc: tangent (0,-1) -> (-sign, 0)
      [x0, -q * K, 0], [x1 + sign * q * K, -q, 0], [x1, -q, 0],
      // straight run (as a degenerate cubic so the path stays uniform)
      [x1 - sign * run * 0.33, -q, 0], [x2 + sign * run * 0.33, -q, 0], [x2, -q, 0],
      // quarter arc into the tip: tangent (-sign, 0) -> (0, -1)
      [x2 - sign * q * K, -q, 0], [0, -2 * q + q * K, 0], [0, -2 * q, 0],
    ];
  };
  vm.appendBezierPoints(halfPath(-1), true);
  vm.appendBezierPoints(halfPath(1), true);
}

export class Brace extends VMobject {
  direction: number[];
  buff: number;
  private _tip: number[];
  private _span: number;

  constructor(mobject: Mobject | number[][], config: BraceConfig = {}) {
    super({
      fillOpacity: 0,
      strokeWidth: 4,
      color: (config as any).color ?? "#FFFFFF",
      ...(config as any),
    });
    this.direction = config.direction ?? V.DOWN;
    this.buff = config.buff ?? DEFAULT_BUFF;
    const sharpness = config.sharpness ?? 2;
    void sharpness;
    const dir = V.normalize(this.direction);

    // manim's algorithm: rotate the target into the frame where `direction`
    // is DOWN, take the bounding box THERE (so a diagonal line braced along
    // its normal hugs the line, not its world-axis bbox), then rotate the
    // placed brace back. Uses the actual family points, not bbox corners.
    const targetAngle = V.angleOf(dir);
    const baseAngle = V.angleOf(V.DOWN); // -pi/2
    const rot = baseAngle - targetAngle; // world -> brace frame
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const toFrame = (p: number[]): number[] => [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos, 0];

    const pts: number[][] = [];
    if (mobject instanceof Mobject) {
      for (const m of mobject.getFamily()) for (const p of (m as any).points ?? []) pts.push(p);
      if (!pts.length) pts.push(mobject.getCenter());
    } else {
      for (const p of mobject as number[][]) pts.push(p);
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity;
    for (const p of pts) {
      const [x, y] = toFrame(p);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
    }
    const span = Math.max(maxX - minX, 0.01);
    this._span = span;

    // Build the centerline in the brace frame: spanning [minX, maxX], top
    // edge `buff` below the target's lower boundary, tip pointing DOWN.
    braceCenterline(this, span, BRACE_HEIGHT);
    const frameCenterX = (minX + maxX) / 2;
    const frameTopY = minY - this.buff;
    this.shift([frameCenterX, frameTopY, 0]);
    const frameTip = [frameCenterX, frameTopY - BRACE_HEIGHT, 0];

    // Rotate everything back into world space.
    this.rotate(-rot, { aboutPoint: [0, 0, 0] });
    const fromFrame = (p: number[]): number[] => [p[0] * cos + p[1] * sin, -p[0] * sin + p[1] * cos, 0];
    this._tip = fromFrame(frameTip);

    if (config.color) this.setColor(config.color);
  }

  // The point at the tip of the brace (where a label attaches).
  getTip(): number[] {
    return this._tip;
  }

  getBraceDirection(): number[] {
    return V.normalize(this.direction);
  }

  // Move a mobject so it sits just beyond the brace tip.
  putAtTip(mob: Mobject, buff = 0.25): this {
    const tip = this.getTip();
    const dir = this.getBraceDirection();
    mob.moveTo(V.add(tip, V.scale(dir, buff + mob.getHeight() / 2)));
    return this;
  }

  // Build a MathTex label placed at the brace tip.
  getTex(...tex: string[]): MathTex {
    const label = new MathTex(tex.join(""));
    this.putAtTip(label);
    return label;
  }

  // Build a Text label placed at the brace tip.
  getText(...text: string[]): Text {
    const label = new Text(text.join(" "));
    this.putAtTip(label);
    return label;
  }
}

// A Brace together with a label mobject, grouped for convenience.
export interface BraceLabelConfig {
  braceDirection?: number[];
  buff?: number;
  labelBuff?: number;
  labelConstructor?: (text: string) => Mobject;
  [key: string]: any;
}

export class BraceLabel extends Group {
  brace: Brace;
  label: Mobject;

  constructor(mobject: Mobject, text: string, config: BraceLabelConfig = {}) {
    super();
    const braceDirection = config.braceDirection ?? V.DOWN;
    const labelConstructor = config.labelConstructor
      ?? ((t: string) => new MathTex(t));
    this.brace = new Brace(mobject, { direction: braceDirection, buff: config.buff });
    this.label = labelConstructor(text);
    this.brace.putAtTip(this.label, config.labelBuff ?? 0.25);
    this.add(this.brace, this.label);
  }

  // Shift the whole group so the brace still hugs a (new) mobject.
  getBrace(): Brace {
    return this.brace;
  }

  getLabel(): Mobject {
    return this.label;
  }
}

// Alias matching manim's BraceText (label built from a tex string).
export class BraceText extends BraceLabel {
  constructor(mobject: Mobject, text: string, config: BraceLabelConfig = {}) {
    super(mobject, text, {
      labelConstructor: (t: string) => new MathTex(t),
      ...config,
    });
  }
}

// A brace spanning the segment between two points.
export interface BraceBetweenPointsConfig extends BraceConfig {
  direction?: number[];
}

export class BraceBetweenPoints extends Brace {
  constructor(p1: number[], p2: number[], config: BraceBetweenPointsConfig = {}) {
    // Default direction is perpendicular to the p1->p2 segment.
    let direction = config.direction;
    if (!direction) {
      const along = V.normalize(V.sub(p2, p1));
      direction = [along[1], -along[0], 0];
    }
    super([p1, p2], { ...config, direction });
  }
}

void VGroup;

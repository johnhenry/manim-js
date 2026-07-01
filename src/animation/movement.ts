// Movement animations mirroring ManimCommunity manim/animation/movement.py.
// These animations move every point of the target mobject as a function of the
// animation's alpha, working from the ORIGINAL points captured at begin().

import { Animation } from "./Animation.ts";
import type { AnimationConfig } from "./Animation.ts";
import * as V from "../core/math/vector.ts";
import { linear } from "./rate_functions.ts";
import type { Mobject } from "../mobject/Mobject.ts";

// A homotopy function H(x, y, z, t) -> [x, y, z]. `t` here is the animation's
// (eased) alpha in [0, 1].
export type HomotopyFn = (x: number, y: number, z: number, t: number) => number[];

/** Config for Homotopy-style animations. */
export interface HomotopyConfig extends AnimationConfig {
  applyFunctionToPoints?: boolean;
}

/**
 * Homotopy: continuously deform a mobject by applying `homotopyFn` at time=alpha
 * to every point. The original points are snapshotted at begin() so the mapping
 * is always evaluated against the un-deformed geometry.
 */
export class Homotopy extends Animation {
  homotopyFn: HomotopyFn;
  startPoints: number[][][];

  constructor(homotopyFn: HomotopyFn, mobject: Mobject, config: HomotopyConfig = {}) {
    super(mobject, { runTime: config.runTime ?? 3, ...config });
    this.homotopyFn = homotopyFn;
    this.startPoints = [];
  }

  setup(): void {
    this.startPoints = this.mobject.getFamily().map((m: any) => m.points.map((p: number[]) => [...p]));
  }

  // Per-family-member hook so subclasses (e.g. SmoothedVectorizedHomotopy) can
  // post-process after the points are set.
  protected applyToMember(_m: any, _index: number): void {}

  interpolateMobject(alpha: number): void {
    const fam = this.mobject.getFamily();
    fam.forEach((m: any, i: number) => {
      const start = this.startPoints[i];
      for (let j = 0; j < m.points.length; j++) {
        const p = start[j];
        const out = this.homotopyFn(p[0], p[1], p[2] ?? 0, alpha);
        m.points[j] = [out[0], out[1] ?? 0, out[2] ?? 0];
      }
      this.applyToMember(m, i);
    });
  }

  finish(): this {
    this.interpolateMobject(1);
    this.finished = true;
    return this;
  }
}

/**
 * SmoothedVectorizedHomotopy: a Homotopy that re-smooths each curve after the
 * points have been moved, so the deformed outline stays smooth.
 */
export class SmoothedVectorizedHomotopy extends Homotopy {
  protected applyToMember(m: any): void {
    if (typeof m.makeSmooth === "function") m.makeSmooth();
  }
}

// A complex homotopy maps a complex number and time to a complex number.
export type ComplexHomotopyFn = (
  z: { re: number; im: number },
  t: number,
) => { re: number; im: number } | number[];

/**
 * ComplexHomotopy: wraps a complex-plane homotopy into a real Homotopy via
 * complexToR3 / R3ToComplex. The z-coordinate is preserved.
 */
export class ComplexHomotopy extends Homotopy {
  constructor(complexHomotopyFn: ComplexHomotopyFn, mobject: Mobject, config: HomotopyConfig = {}) {
    const homotopy: HomotopyFn = (x, y, z, t) => {
      const w = complexHomotopyFn(V.R3ToComplex([x, y, z]), t);
      const r3 = V.complexToR3(w as any);
      return [r3[0], r3[1], z];
    };
    super(homotopy, mobject, config);
  }
}

// A velocity field maps a point to a velocity vector.
export type VelocityFn = (point: number[]) => number[];

/** Config for PhaseFlow. */
export interface PhaseFlowConfig extends AnimationConfig {
  virtualTime?: number;
  suspendMobjectUpdating?: boolean;
}

/**
 * PhaseFlow: integrate each point of the mobject along a vector field
 * `velocityFn` over `virtualTime`. Points advance by velocity * dt each frame,
 * where dt is derived from the change in alpha between successive frames.
 */
export class PhaseFlow extends Animation {
  velocityFn: VelocityFn;
  virtualTime: number;
  lastAlpha: number | null;

  constructor(velocityFn: VelocityFn, mobject: Mobject, config: PhaseFlowConfig = {}) {
    super(mobject, {
      runTime: config.runTime ?? 3,
      rateFunc: config.rateFunc ?? linear,
      ...config,
    });
    this.velocityFn = velocityFn;
    this.virtualTime = config.virtualTime ?? 1;
    this.lastAlpha = null;
  }

  interpolateMobject(alpha: number): void {
    if (this.lastAlpha != null) {
      const dt = this.virtualTime * (alpha - this.lastAlpha);
      if (dt !== 0) {
        this.mobject.applyToPoints((p: number[]) => {
          const v = this.velocityFn(p);
          return V.add(p, V.scale([v[0], v[1] ?? 0, v[2] ?? 0], dt));
        });
      }
    }
    this.lastAlpha = alpha;
  }
}

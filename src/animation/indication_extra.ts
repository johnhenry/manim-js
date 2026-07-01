// Additional indication animations mirroring ManimCommunity
// manim/animation/indication.py (ShowPassingFlash & friends, ApplyWave, Blink).

import { Animation } from "./Animation.ts";
import type { AnimationConfig } from "./Animation.ts";
import * as V from "../core/math/vector.ts";
import * as rf from "./rate_functions.ts";
import type { Mobject } from "../mobject/Mobject.ts";
import type { Vec3 } from "../core/types.ts";

/** Config accepted by the passing-flash animations. */
export interface PassingFlashConfig extends AnimationConfig {
  timeWidth?: number;
  nSegments?: number;
}

/**
 * ShowPassingFlash: a bright segment of the outline slides from the start of the
 * mobject to the end. Implemented by sliding a [strokeStart, strokeEnd] window
 * of width `timeWidth` from just before 0 to just past 1. Remover: the temporary
 * highlight is removed and the mobject fully restored when done.
 */
export class ShowPassingFlash extends Animation {
  timeWidth: number;
  startStroke: Array<{ start: number; end: number }>;

  constructor(vmobject: Mobject, config: PassingFlashConfig = {}) {
    super(vmobject, { ...config, remover: true });
    this.timeWidth = config.timeWidth ?? 0.1;
    this.startStroke = [];
  }

  setup(): void {
    this.startStroke = this.mobject.getFamily().map((m: any) => ({
      start: m.strokeStart ?? 0,
      end: m.strokeEnd ?? 1,
    }));
  }

  interpolateMobject(alpha: number): void {
    const tw = this.timeWidth;
    // The window's upper edge sweeps from 0 to 1 + tw; its lower edge trails by
    // tw. Clamp both into [0, 1] so only the visible slice is drawn.
    const upper = alpha * (1 + tw);
    const lower = upper - tw;
    const a = Math.max(0, Math.min(1, lower));
    const b = Math.max(0, Math.min(1, upper));
    this.mobject.getFamily().forEach((m: any) => {
      m.strokeStart = a;
      m.strokeEnd = b;
    });
  }

  finish(): this {
    // Restore the original stroke window before removal.
    this.mobject.getFamily().forEach((m: any, i: number) => {
      const s = this.startStroke[i];
      if (s) {
        m.strokeStart = s.start;
        m.strokeEnd = s.end;
      }
    });
    this.finished = true;
    return this;
  }
}

/**
 * ShowPassingFlashWithThinningStrokeWidth: like ShowPassingFlash, but the flash
 * segment's stroke width tapers toward its trailing edge. `nSegments` controls
 * the resolution of the taper (here approximated by scaling the whole stroke
 * width by a triangular envelope over the sweep).
 */
export class ShowPassingFlashWithThinningStrokeWidth extends ShowPassingFlash {
  nSegments: number;
  startWidths: number[];

  constructor(vmobject: Mobject, config: PassingFlashConfig = {}) {
    super(vmobject, config);
    this.nSegments = config.nSegments ?? 10;
    this.startWidths = [];
  }

  setup(): void {
    super.setup();
    this.startWidths = this.mobject.getFamily().map((m: any) => m.strokeWidth ?? 4);
  }

  interpolateMobject(alpha: number): void {
    super.interpolateMobject(alpha);
    // Taper: full width at the sweep's midpoint, thinning toward the ends.
    const envelope = rf.thereAndBack(alpha);
    this.mobject.getFamily().forEach((m: any, i: number) => {
      m.strokeWidth = this.startWidths[i] * (0.05 + 0.95 * envelope);
    });
  }

  finish(): this {
    super.finish();
    this.mobject.getFamily().forEach((m: any, i: number) => {
      if (this.startWidths[i] != null) m.strokeWidth = this.startWidths[i];
    });
    return this;
  }
}

/** Config for ApplyWave. */
export interface ApplyWaveConfig extends AnimationConfig {
  direction?: Vec3 | number[];
  amplitude?: number;
  wavelength?: number;
  timeWidth?: number;
}

/**
 * ApplyWave: a transverse wave passes through the mobject. Each point is
 * displaced along `direction` by a sine whose phase depends on the point's
 * position along the perpendicular axis and the (there-and-back) alpha, so the
 * mobject returns to its original shape at alpha=1.
 */
export class ApplyWave extends Animation {
  direction: number[];
  amplitude: number;
  wavelength: number;
  timeWidth: number;
  startPoints: number[][][];
  axisMin: number;
  axisSpan: number;

  constructor(mobject: Mobject, config: ApplyWaveConfig = {}) {
    super(mobject, {
      runTime: config.runTime ?? 1,
      ...config,
    });
    this.direction = config.direction ?? V.UP;
    this.amplitude = config.amplitude ?? 0.2;
    this.wavelength = config.wavelength ?? 1;
    this.timeWidth = config.timeWidth ?? 1;
    this.startPoints = [];
    this.axisMin = 0;
    this.axisSpan = 1;
  }

  setup(): void {
    this.startPoints = this.mobject.getFamily().map((m: any) => m.points.map((p: number[]) => [...p]));
    // Wave travels along the axis perpendicular to `direction`. Measure the
    // span of the mobject along that propagation axis to normalize the phase.
    const propAxis = this._propagationAxis();
    let min = Infinity;
    let max = -Infinity;
    for (const p of this.mobject.getAllPoints()) {
      const s = V.dot(p, propAxis);
      if (s < min) min = s;
      if (s > max) max = s;
    }
    if (!isFinite(min)) { min = 0; max = 1; }
    this.axisMin = min;
    this.axisSpan = max - min || 1;
  }

  private _propagationAxis(): number[] {
    // Perpendicular (in-plane) to the displacement direction.
    const d = V.normalize(this.direction);
    const perp: number[] = [-d[1], d[0], 0];
    if (V.length(perp) === 0) return [1, 0, 0];
    return V.normalize(perp);
  }

  interpolateMobject(alpha: number): void {
    const dir = V.normalize(this.direction);
    const propAxis = this._propagationAxis();
    // Envelope so the wave grows in and settles back to zero (restoring shape).
    const env = rf.thereAndBack(alpha);
    // The wave crest position sweeps across the mobject as alpha advances.
    const phaseShift = alpha * V.TAU * this.timeWidth;
    const fam = this.mobject.getFamily();
    fam.forEach((m: any, i: number) => {
      const start = this.startPoints[i];
      for (let j = 0; j < m.points.length; j++) {
        const p = start[j];
        const s = (V.dot(p, propAxis) - this.axisMin) / this.axisSpan;
        const disp = this.amplitude * env * Math.sin((V.TAU * s) / this.wavelength - phaseShift);
        m.points[j] = V.add(p, V.scale(dir, disp));
      }
    });
  }

  finish(): this {
    // Restore exactly to the original geometry.
    const fam = this.mobject.getFamily();
    fam.forEach((m: any, i: number) => {
      m.points = this.startPoints[i].map((p: number[]) => [...p]);
    });
    this.finished = true;
    return this;
  }
}

/** Config for Blink. */
export interface BlinkConfig extends AnimationConfig {
  timeOn?: number;
  timeOff?: number;
  blinks?: number;
  hideAtEnd?: boolean;
}

/**
 * Blink: toggle the mobject's opacity on and off `blinks` times. Each cycle
 * lasts timeOn + timeOff; the mobject is visible during the first timeOn slice.
 */
export class Blink extends Animation {
  timeOn: number;
  timeOff: number;
  blinks: number;
  hideAtEnd: boolean;
  startOpacities: Array<{ fill: number; stroke: number; op: number }>;

  constructor(mobject: Mobject, config: BlinkConfig = {}) {
    const timeOn = config.timeOn ?? 0.5;
    const timeOff = config.timeOff ?? 0.5;
    const blinks = config.blinks ?? 1;
    super(mobject, {
      runTime: config.runTime ?? (timeOn + timeOff) * blinks,
      rateFunc: config.rateFunc ?? rf.linear,
      ...config,
    });
    this.timeOn = timeOn;
    this.timeOff = timeOff;
    this.blinks = blinks;
    this.hideAtEnd = config.hideAtEnd ?? false;
    this.startOpacities = [];
  }

  setup(): void {
    this.startOpacities = this.mobject.getFamily().map((m: any) => ({
      fill: m.fillOpacity ?? m.opacity ?? 1,
      stroke: m.strokeOpacity ?? m.opacity ?? 1,
      op: m.opacity ?? 1,
    }));
  }

  private _visibleAt(alpha: number): boolean {
    const period = this.timeOn + this.timeOff;
    const total = period * this.blinks;
    const t = alpha * total;
    const phase = t % period;
    return phase < this.timeOn;
  }

  interpolateMobject(alpha: number): void {
    const on = this._visibleAt(alpha);
    this.mobject.getFamily().forEach((m: any, i: number) => {
      const s = this.startOpacities[i];
      const f = on ? 1 : 0;
      m.fillOpacity = s.fill * f;
      m.strokeOpacity = s.stroke * f;
      m.opacity = s.op * f;
    });
  }

  finish(): this {
    // Restore full visibility (unless hideAtEnd) at the end of the blink.
    this.mobject.getFamily().forEach((m: any, i: number) => {
      const s = this.startOpacities[i];
      const f = this.hideAtEnd ? 0 : 1;
      m.fillOpacity = s.fill * f;
      m.strokeOpacity = s.stroke * f;
      m.opacity = s.op * f;
    });
    this.finished = true;
    return this;
  }
}

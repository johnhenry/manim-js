// Scale bases for NumberLine / Axes. A scale base maps between the "data" value
// a user thinks in (e.g. 100 on a log axis) and the "position" value used for
// the affine layout (e.g. 2, since log10(100) = 2). Mirrors ManimCommunity's
// manim/mobject/graphing/scale.py (_ScaleBase, LinearBase, LogBase).

/**
 * Interface every scale base implements.
 *
 * `functionOf` is applied to a data value before it is placed on the line;
 * `inverseFunctionOf` recovers the data value from a placed position. For a
 * linear axis both are the identity. For a log axis `functionOf` is log_base
 * and its inverse is base**x.
 */
export interface _ScaleBase {
  /** Map a raw data value to its position on the line. */
  functionOf(value: number): number;
  /** Inverse of `functionOf`: position -> data value. */
  inverseFunctionOf(value: number): number;
  /**
   * Optional custom tick values / labels for the axis. Returning `null` means
   * "use the default numeric ticks". Log scales override this to produce
   * powers of the base.
   */
  getCustomLabels?(
    valueRange: number[],
    opts?: { unitDecimalPlaces?: number; [key: string]: any }
  ): { value: number; label: string }[] | null;
}

/** Identity scale — the default for every axis. */
export class LinearBase implements _ScaleBase {
  scaleFactor: number;

  constructor(scaleFactor = 1.0) {
    this.scaleFactor = scaleFactor;
  }

  functionOf(value: number): number {
    return this.scaleFactor * value;
  }

  inverseFunctionOf(value: number): number {
    return value / this.scaleFactor;
  }

  getCustomLabels(): null {
    return null;
  }
}

/** Logarithmic scale. `functionOf(x) = log_base(x)`, inverse `base**x`. */
export class LogBase implements _ScaleBase {
  base: number;
  customLabels: boolean;

  constructor(base = 10, customLabels = true) {
    this.base = base;
    this.customLabels = customLabels;
  }

  functionOf(value: number): number {
    return Math.log(value) / Math.log(this.base);
  }

  inverseFunctionOf(value: number): number {
    return Math.pow(this.base, value);
  }

  /**
   * Produce labels of the form `base^exponent` at each integer position across
   * the (already log-space) value range. `valueRange` here is expressed in data
   * units (e.g. [1, 1000, ...]); we walk the exponents between them.
   */
  getCustomLabels(
    valueRange: number[],
    opts: { unitDecimalPlaces?: number; [key: string]: any } = {}
  ): { value: number; label: string }[] {
    if (!this.customLabels) return [];
    const out: { value: number; label: string }[] = [];
    for (const value of valueRange) {
      const exponent = Math.round(this.functionOf(value));
      out.push({ value, label: `${this.base}^{${exponent}}` });
    }
    return out;
  }
}

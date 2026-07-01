// Animations that drive a DecimalNumber's displayed value. Mirrors
// manim.animation.numbers (ChangingDecimal / ChangeDecimalToValue). Each frame
// the eased alpha is turned into a number via a user function and pushed onto
// the decimal via setValue.

import { Animation } from "./Animation.ts";
import type { AnimationConfig } from "./Animation.ts";
import type { Mobject } from "../mobject/Mobject.ts";

export type NumberUpdateFunc = (alpha: number) => number;

export class ChangingDecimal extends Animation {
  decimalMob: any;
  numberUpdateFunc: NumberUpdateFunc;

  constructor(decimalMob: Mobject, numberUpdateFunc: NumberUpdateFunc, config: AnimationConfig = {}) {
    // manim suspends the decimal's own updaters while animating its value.
    super(decimalMob, { suspendMobjectUpdating: false, ...config });
    this.decimalMob = decimalMob;
    this.numberUpdateFunc = numberUpdateFunc;
  }

  interpolateMobject(alpha: number): void {
    this.decimalMob.setValue(this.numberUpdateFunc(alpha));
  }
}

export class ChangeDecimalToValue extends ChangingDecimal {
  startValue: number;
  targetValue: number;

  constructor(decimalMob: any, targetValue: number, config: AnimationConfig = {}) {
    // Capture the start value at construction (matching manim, which reads
    // number_start_at at __init__ time).
    const startValue = decimalMob.getValue();
    super(decimalMob, (a: number) => startValue + (targetValue - startValue) * a, config);
    this.startValue = startValue;
    this.targetValue = targetValue;
  }
}

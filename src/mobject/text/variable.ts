// Variable: a labeled, live-updating number bound to a ValueTracker. Mirrors
// manim.mobject.text.numbers.Variable. Layout is  <label> = <number> arranged
// horizontally; the number is a DecimalNumber (or Integer) whose value follows
// `this.tracker` via an updater.

import { VGroup } from "../VMobject.ts";
import { Text } from "./Text.ts";
import { DecimalNumber, ValueTracker } from "../value_tracker.ts";
import type { DecimalNumberConfig } from "../value_tracker.ts";
import * as V from "../../core/math/vector.ts";

export interface VariableConfig extends DecimalNumberConfig {
  varType?: any; // DecimalNumber | Integer constructor
  numDecimalPlaces?: number;
}

export class Variable extends VGroup {
  tracker: ValueTracker;
  label: any;
  value: DecimalNumber;
  private _equals: Text;

  constructor(value = 0, label: any = "x", config: VariableConfig = {}) {
    super();

    this.tracker = new ValueTracker(value);

    const VarType = config.varType ?? DecimalNumber;
    const numDecimalPlaces = config.numDecimalPlaces ?? 2;

    // The label may be passed as a string or a prebuilt mobject.
    this.label = typeof label === "string" || typeof label === "number"
      ? new Text(String(label))
      : label;

    this._equals = new Text("=");

    const numConfig: DecimalNumberConfig = { ...config, numDecimalPlaces };
    delete (numConfig as any).varType;
    this.value = new VarType(value, numConfig);

    this.add(this.label, this._equals, this.value);
    this.arrange(V.RIGHT, 0.25);

    // Keep the displayed number in sync with the tracker every frame.
    this.value.addUpdater(() => {
      this.value.setValue(this.tracker.getValue());
    });
  }

  getValue(): number {
    return this.tracker.getValue();
  }
}

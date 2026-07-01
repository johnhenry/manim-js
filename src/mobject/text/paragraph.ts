// Paragraph: multiple lines of Text arranged vertically with a shared
// alignment. Mirrors manim.mobject.text.text_mobject.Paragraph. Each argument
// line becomes a Text; `.lines` is a VGroup of those line mobjects, and
// `.chars` is a VGroup mirroring the same lines (the per-glyph subdivision that
// raster Text does not expose, so `.chars` groups by line here).

import { VGroup } from "../VMobject.ts";
import { Text } from "./Text.ts";
import type { TextConfig } from "./Text.ts";
import * as V from "../../core/math/vector.ts";

export interface ParagraphConfig extends TextConfig {
  lineSpacing?: number;
  alignment?: "left" | "center" | "right";
}

export class Paragraph extends VGroup {
  lines: VGroup;
  chars: VGroup;
  alignment: string;
  lineSpacing: number;

  constructor(...args: any[]) {
    super();

    // The trailing argument may be a config object; the rest are line strings.
    let config: ParagraphConfig = {};
    if (
      args.length &&
      typeof args[args.length - 1] === "object" &&
      args[args.length - 1] !== null &&
      !Array.isArray(args[args.length - 1])
    ) {
      config = args.pop();
    }
    const lineStrings: string[] = args.map((a) => String(a));

    this.alignment = config.alignment ?? "left";
    // manim default line_spacing is derived from font size; -1 means auto.
    this.lineSpacing = config.lineSpacing ?? 0.15;

    const textConfig: TextConfig = { ...config };
    delete (textConfig as any).lineSpacing;
    delete (textConfig as any).alignment;

    const lineMobs = lineStrings.map((s) => new Text(s, textConfig));

    this.lines = new VGroup(...lineMobs);
    this.chars = new VGroup(...lineMobs);

    // Stack the lines vertically.
    for (let i = 1; i < lineMobs.length; i++) {
      lineMobs[i].nextTo(lineMobs[i - 1], V.DOWN, this.lineSpacing);
    }
    this._applyAlignment();

    this.add(...lineMobs);
    this.center();
  }

  private _applyAlignment(): void {
    const mobs = this.lines.submobjects;
    if (mobs.length === 0) return;
    if (this.alignment === "left") {
      const x = Math.min(...mobs.map((m) => m.getLeft()[0]));
      for (const m of mobs) m.alignTo([x, 0, 0], V.LEFT);
    } else if (this.alignment === "right") {
      const x = Math.max(...mobs.map((m) => m.getRight()[0]));
      for (const m of mobs) m.alignTo([x, 0, 0], V.RIGHT);
    } else {
      // center: align each line's center x to the group center x.
      const c = this.getCenter()[0];
      for (const m of mobs) {
        const dx = c - m.getCenter()[0];
        m.shift([dx, 0, 0]);
      }
    }
  }
}

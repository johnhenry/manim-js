// Legend + ColorBar: axis-free "key" widgets that recur across the chart
// mobjects (PieChart, RadarChart, ...) and, per the ECharts parity campaign,
// are needed to reproduce native `legend` and `visualMap` widgets. Both were
// previously hand-rolled per-demo as ad-hoc VGroups; this module makes them
// real, tested, exported mobjects (see charts.ts's header for the sibling
// convention this file follows: VGroup-based, addressable submobject arrays,
// identity-preserving updates where the PieChart precedent calls for it).

import { VMobject, VGroup } from "./VMobject.ts";
import { Rectangle, Circle, Line } from "./geometry.ts";
import { Text } from "./text/Text.ts";
import { Color } from "../core/color.ts";
import { interpolateViridis } from "../core/color_schemes.ts";
import * as V from "../core/math/vector.ts";
import type { ColorLike } from "../core/types.ts";

// --- Legend ------------------------------------------------------------------

export interface LegendItem {
  label: string;
  color: ColorLike;
  /** Swatch shape (default 'rect'). */
  shape?: "rect" | "circle" | "line";
}

export interface LegendConfig {
  /** Stack items top-to-bottom ('vertical', default) or left-to-right. */
  orientation?: "horizontal" | "vertical";
  /** Spacing between item rows (vertical) or item pairs (horizontal). */
  itemSpacing?: number;
  swatchSize?: number;
  fontSize?: number;
  textColor?: ColorLike;
  /** Gap between a swatch and its label. */
  gap?: number;
}

/**
 * A categorical legend: one color swatch + one text label per item, stacked
 * vertically or flowed horizontally. `swatches`/`labels` are addressable for
 * per-item animation; `setItems()` rebuilds IN PLACE — with the same item
 * count, swatch mobjects keep their identity (geometry/color rewritten, same
 * convention as `PieChart.setValues`); labels are always regenerated (their
 * glyph geometry is a function of text content).
 */
export class Legend extends VGroup {
  items: LegendItem[];
  readonly swatches: VMobject[] = [];
  readonly labels: Text[] = [];
  private readonly _config: LegendConfig;
  private readonly _swatchesGroup = new VGroup();
  private readonly _labelsGroup = new VGroup();

  constructor(items: LegendItem[], config: LegendConfig = {}) {
    super();
    this.items = [...items];
    this._config = config;
    this.add(this._swatchesGroup, this._labelsGroup);
    this._build();
  }

  private _makeSwatch(item: LegendItem): VMobject {
    const { swatchSize = 0.25 } = this._config;
    const shape = item.shape ?? "rect";
    const color = item.color;
    if (shape === "circle") {
      return new Circle({
        radius: swatchSize / 2, color, fillColor: color, fillOpacity: 1, strokeWidth: 0,
      });
    }
    if (shape === "line") {
      return new Line([-swatchSize / 2, 0, 0], [swatchSize / 2, 0, 0], { color, strokeWidth: 4 });
    }
    return new Rectangle({
      width: swatchSize, height: swatchSize, color, fillColor: color, fillOpacity: 1, strokeWidth: 0,
    });
  }

  private _makeLabel(item: LegendItem): Text {
    const { fontSize = 0.3, textColor } = this._config;
    return new Text(item.label, { fontSize, ...(textColor !== undefined ? { color: textColor } : {}) });
  }

  /** Place `swatch` + `label` for row/column `i`, chaining off `prevLabel` in horizontal mode. */
  private _position(swatch: VMobject, label: Text, i: number, prevLabel: Text | null): void {
    const { orientation = "vertical", itemSpacing = 0.3, gap = 0.15 } = this._config;
    if (orientation === "vertical") {
      const y = -i * itemSpacing;
      swatch.moveTo([0, y, 0]);
      label.moveTo([0, y, 0]);
      label.nextTo(swatch, V.RIGHT, gap);
    } else {
      swatch.moveTo([0, 0, 0]);
      if (prevLabel) swatch.nextTo(prevLabel, V.RIGHT, itemSpacing);
      label.moveTo([0, 0, 0]);
      label.nextTo(swatch, V.RIGHT, gap);
    }
  }

  private _build(): void {
    this._swatchesGroup.submobjects.length = 0;
    this._labelsGroup.submobjects.length = 0;
    this.swatches.length = 0;
    this.labels.length = 0;
    let prevLabel: Text | null = null;
    this.items.forEach((item, i) => {
      const swatch = this._makeSwatch(item);
      const label = this._makeLabel(item);
      this._position(swatch, label, i, prevLabel);
      this.swatches.push(swatch);
      this.labels.push(label);
      prevLabel = label;
    });
    this._swatchesGroup.add(...this.swatches);
    this._labelsGroup.add(...this.labels);
  }

  setItems(items: LegendItem[]): this {
    this.items = [...items];
    if (items.length !== this.swatches.length) {
      this._build();
      return this;
    }
    // Identity-preserving path: rewrite each existing swatch's geometry/color
    // in place (Transform-friendly); labels are regenerated wholesale.
    this._labelsGroup.submobjects.length = 0;
    this.labels.length = 0;
    let prevLabel: Text | null = null;
    this.items.forEach((item, i) => {
      const swatch = this.swatches[i];
      const fresh = this._makeSwatch(item);
      swatch.points = fresh.points;
      swatch.subpathStarts = fresh.subpathStarts;
      (swatch as any)._straightPath = (fresh as any)._straightPath;
      swatch.fillColor = fresh.fillColor;
      swatch.strokeColor = fresh.strokeColor;
      swatch.fillOpacity = fresh.fillOpacity;
      swatch.strokeWidth = fresh.strokeWidth;
      const label = this._makeLabel(item);
      this._position(swatch, label, i, prevLabel);
      this.labels.push(label);
      prevLabel = label;
    });
    this._labelsGroup.add(...this.labels);
    return this;
  }
}

// --- ColorBar ------------------------------------------------------------------

const GRADIENT_STOPS = 32;
const TICK_GAP = 0.15;
const LABEL_GAP = 0.2;

export interface ColorBarConfig {
  /** Bar thickness (short axis), default 0.4. */
  width?: number;
  /** Bar extent along its long axis, default 3. */
  length?: number;
  orientation?: "horizontal" | "vertical";
  /** [min, max] value range the bar represents, default [0, 1]. */
  domain?: [number, number];
  /** t in [0,1] -> color. Default `interpolateViridis` (color_schemes.ts) — a
   *  perceptually-uniform sequential ramp, the conventional default for a
   *  value->color legend when no scheme is specified (matplotlib/d3 both
   *  default sequential colormaps to viridis for the same reason). */
  interpolator?: (t: number) => ColorLike;
  tickCount?: number;
  tickFontSize?: number;
  tickFormat?: (value: number) => string;
  textColor?: ColorLike;
  /** Optional title, placed above the bar. */
  label?: string;
  labelFontSize?: number;
}

/**
 * A gradient swatch bar with numeric tick labels — the widget behind
 * ECharts' `visualMap` (see examples/echarts-parity/ref/04-scatter-visualmap.js)
 * and any other value->color legend.
 *
 * The gradient fill reuses the multi-stop `gradientColors`/`sheenDirection`
 * mechanism VMobject already exposes generically (the same fields
 * `Axes.getArea()` sets on its Polygon for a gradient-colored area — see
 * coordinate_systems.ts) rather than approximating the ramp with N adjacent
 * solid rectangles: both CanvasRenderer._buildGradient and the SVG renderer
 * read `gradientColors` as an arbitrary-length stop list (not limited to 2
 * colors), so a plain `Rectangle` with 32 sampled stops renders a smooth
 * `ctx.createLinearGradient` ramp for free.
 */
export class ColorBar extends VGroup {
  domain: [number, number];
  readonly bar: Rectangle;
  readonly ticks: Text[] = [];
  label?: Text;
  private readonly _config: ColorBarConfig;
  private readonly _ticksGroup = new VGroup();

  constructor(config: ColorBarConfig = {}) {
    super();
    this._config = config;
    this.domain = config.domain ?? [0, 1];
    this.bar = this._makeBar();
    this.add(this.bar, this._ticksGroup);
    this._buildTicks();
    if (config.label) {
      const { labelFontSize, tickFontSize = 0.25, textColor } = config;
      this.label = new Text(config.label, {
        fontSize: labelFontSize ?? tickFontSize,
        ...(textColor !== undefined ? { color: textColor } : {}),
      });
      this._positionLabel();
      this.add(this.label);
    }
  }

  private get _orientation(): "horizontal" | "vertical" {
    return this._config.orientation ?? "vertical";
  }

  private _makeBar(): Rectangle {
    const { width = 0.4, length = 3 } = this._config;
    const vertical = this._orientation === "vertical";
    const rect = new Rectangle({
      width: vertical ? width : length,
      height: vertical ? length : width,
      strokeWidth: 0,
      fillOpacity: 1,
    });
    const interpolator = this._config.interpolator ?? interpolateViridis;
    const stops: Color[] = [];
    for (let i = 0; i < GRADIENT_STOPS; i++) {
      stops.push(Color.parse(interpolator(i / (GRADIENT_STOPS - 1))));
    }
    // sheenDirection UP/RIGHT places stop[0] (interpolator(0)) at the
    // bottom/left and stop[last] (interpolator(1)) at the top/right of the
    // rectangle's bounding box (see CanvasRenderer._buildGradient) —
    // matching domain[0] at the bar's low end, domain[1] at its high end.
    rect.gradientColors = stops;
    rect.sheenDirection = vertical ? V.UP : V.RIGHT;
    return rect;
  }

  private _tickFrac(i: number, count: number): number {
    return count <= 1 ? 0.5 : i / (count - 1);
  }

  private _tickPoint(frac: number): number[] {
    const { width = 0.4, length = 3 } = this._config;
    const vertical = this._orientation === "vertical";
    if (vertical) {
      const y = -length / 2 + frac * length;
      return [width / 2 + TICK_GAP, y, 0];
    }
    const x = -length / 2 + frac * length;
    return [x, -width / 2 - TICK_GAP, 0];
  }

  private _buildTicks(): void {
    this._ticksGroup.submobjects.length = 0;
    this.ticks.length = 0;
    const { tickCount = 5, tickFontSize = 0.25, tickFormat, textColor } = this._config;
    const fmt = tickFormat ?? ((v: number) => String(Math.round(v)));
    const [d0, d1] = this.domain;
    for (let i = 0; i < tickCount; i++) {
      const frac = this._tickFrac(i, tickCount);
      const value = d0 + frac * (d1 - d0);
      const text = new Text(fmt(value), {
        fontSize: tickFontSize,
        point: this._tickPoint(frac),
        ...(textColor !== undefined ? { color: textColor } : {}),
      });
      this.ticks.push(text);
    }
    this._ticksGroup.add(...this.ticks);
  }

  private _positionLabel(): void {
    if (!this.label) return;
    const { length = 3, width = 0.4 } = this._config;
    const vertical = this._orientation === "vertical";
    // Above the bar in both orientations (vertical: past the top tick's
    // extent along the bar's length; horizontal: above the bar's thickness).
    const y = vertical ? length / 2 + LABEL_GAP : width / 2 + LABEL_GAP;
    this.label.moveTo([0, y, 0]);
  }

  /**
   * Update the value range. Tick *positions* are a function of orientation
   * geometry only (fixed fractions along the bar), so only the tick label
   * *text* changes; the gradient itself is domain-independent (the
   * interpolator takes a normalized t, not a raw value) so it's left as-is.
   * Ticks are regenerated wholesale (same rationale as Legend's labels).
   */
  setDomain(domain: [number, number]): this {
    this.domain = domain;
    this._buildTicks();
    return this;
  }
}

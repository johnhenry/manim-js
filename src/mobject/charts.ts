// Standalone chart mobjects that don't need an Axes coordinate system.
// (BarChart lives in probability.ts as an Axes subclass; line plots come from
// Axes.plotLineGraph. This module holds the axis-free charts — currently
// PieChart.)

import { VMobject, VGroup } from "./VMobject.ts";
import { Sector, AnnularSector } from "./arcs.ts";
import { Text } from "./text/Text.ts";
import { TAU } from "../core/math/vector.ts";
import { BLUE, YELLOW, RED, GREEN, PURPLE, ORANGE, TEAL, PINK } from "../core/color.ts";
import type { ColorLike } from "../core/types.ts";

const DEFAULT_SLICE_COLORS: ColorLike[] = [BLUE, YELLOW, RED, GREEN, PURPLE, ORANGE, TEAL, PINK];

export interface PieChartConfig {
  /** Outer radius in world units (default 2). */
  radius?: number;
  /** Slice fill colors, cycled when there are more slices than colors. */
  colors?: ColorLike[];
  /** Angle of the FIRST slice's leading edge (default TAU/4 — 12 o'clock). */
  startAngle?: number;
  /** Inner radius > 0 makes a donut (default 0). */
  innerRadius?: number;
  /** Gap between adjacent slices, in radians (default 0). */
  gapAngle?: number;
  /** true → percentage labels; or explicit label strings (one per value). */
  labels?: boolean | string[];
  /** Custom label text from (value, index, fraction). Implies labels on. */
  labelFormat?: (value: number, index: number, fraction: number) => string;
  /** Label font size in world units (default 0.4). */
  labelFontSize?: number;
  labelColor?: ColorLike;
  strokeColor?: ColorLike;
  strokeWidth?: number;
  fillOpacity?: number;
}

/**
 * A pie / donut chart: one sector per value, angles proportional to the
 * values, laid out clockwise from `startAngle`. `slices` (and `labels`, when
 * enabled) are addressable for per-slice animation; `setValues()` rebuilds
 * the geometry IN PLACE — the slice mobjects keep their identity, so
 * updaters, Transforms, and references to `chart.slices[i]` stay valid.
 */
export class PieChart extends VGroup {
  values: number[];
  readonly slices: VMobject[] = [];
  readonly labels: Text[] = [];
  private readonly _config: PieChartConfig;
  private readonly _slicesGroup = new VGroup();
  private readonly _labelsGroup = new VGroup();

  constructor(values: number[], config: PieChartConfig = {}) {
    super();
    this.values = [...values];
    this._config = config;
    this.add(this._slicesGroup, this._labelsGroup);
    this._build();
  }

  private _sliceGeometry(): Array<{ startAngle: number; angle: number; midAngle: number; fraction: number }> {
    const { startAngle = TAU / 4, gapAngle = 0 } = this._config;
    const total = this.values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
    const out: Array<{ startAngle: number; angle: number; midAngle: number; fraction: number }> = [];
    let cursor = startAngle;
    for (const raw of this.values) {
      const fraction = Math.max(0, raw) / total;
      const sweep = fraction * TAU;
      // Clockwise: angles decrease. Gap is split evenly on both sides.
      const gap = Math.min(gapAngle, sweep);
      out.push({
        startAngle: cursor - sweep + gap / 2,
        angle: sweep - gap,
        midAngle: cursor - sweep / 2,
        fraction,
      });
      cursor -= sweep;
    }
    return out;
  }

  private _makeSlice(geo: { startAngle: number; angle: number }, i: number): VMobject {
    const {
      radius = 2, innerRadius = 0, colors = DEFAULT_SLICE_COLORS,
      strokeColor, strokeWidth = 0, fillOpacity = 1,
    } = this._config;
    const color = colors[i % colors.length];
    const common = {
      startAngle: geo.startAngle, angle: geo.angle,
      color, fillOpacity, strokeWidth,
      ...(strokeColor !== undefined ? { strokeColor } : {}),
    };
    return innerRadius > 0
      ? new AnnularSector({ ...common, innerRadius, outerRadius: radius })
      : new Sector({ ...common, radius });
  }

  private _labelText(value: number, i: number, fraction: number): string | null {
    const { labels, labelFormat } = this._config;
    if (labelFormat) return labelFormat(value, i, fraction);
    if (Array.isArray(labels)) return labels[i] ?? null;
    if (labels) return `${Math.round(fraction * 100)}%`;
    return null;
  }

  private _labelRadius(): number {
    const { radius = 2, innerRadius = 0 } = this._config;
    // Mid-ring for donuts; a bit past halfway for full pies (visual center of
    // mass of a slice sits outward of r/2).
    return innerRadius > 0 ? (innerRadius + radius) / 2 : radius * 0.6;
  }

  private _buildLabels(geos: ReturnType<PieChart["_sliceGeometry"]>): void {
    const { labels, labelFormat, labelFontSize = 0.4, labelColor } = this._config;
    this._labelsGroup.submobjects.length = 0;
    this.labels.length = 0;
    if (!labels && !labelFormat) return;
    const lr = this._labelRadius();
    geos.forEach((geo, i) => {
      const text = this._labelText(this.values[i], i, geo.fraction);
      if (text == null || geo.angle <= 0) return;
      const label = new Text(text, {
        fontSize: labelFontSize,
        ...(labelColor !== undefined ? { color: labelColor } : {}),
      });
      label.moveTo([lr * Math.cos(geo.midAngle), lr * Math.sin(geo.midAngle), 0]);
      this.labels.push(label);
    });
    this._labelsGroup.add(...this.labels);
  }

  private _build(): void {
    const geos = this._sliceGeometry();
    geos.forEach((geo, i) => {
      this.slices.push(this._makeSlice(geo, i));
    });
    this._slicesGroup.add(...this.slices);
    this._buildLabels(geos);
  }

  /**
   * Update the chart to new values, rebuilding geometry in place. With the
   * same number of values, each existing slice mobject's points are rewritten
   * (identity preserved — Transform-friendly); a changed count replaces the
   * slice list. Labels are always regenerated.
   */
  setValues(values: number[]): this {
    this.values = [...values];
    const geos = this._sliceGeometry();
    if (geos.length === this.slices.length) {
      geos.forEach((geo, i) => {
        const fresh = this._makeSlice(geo, i);
        const slice = this.slices[i];
        slice.points = fresh.points;
        slice.subpathStarts = fresh.subpathStarts;
        (slice as any)._straightPath = (fresh as any)._straightPath;
        if (slice instanceof AnnularSector && fresh instanceof AnnularSector) {
          slice.startAngle = fresh.startAngle;
          slice.angle = fresh.angle;
        }
      });
    } else {
      this._slicesGroup.submobjects.length = 0;
      this.slices.length = 0;
      geos.forEach((geo, i) => this.slices.push(this._makeSlice(geo, i)));
      this._slicesGroup.add(...this.slices);
    }
    // Labels: regenerate (cheap, and their texts change with the values).
    this._buildLabels(geos);
    return this;
  }
}

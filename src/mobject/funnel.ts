// FunnelChart: a stack of tapering trapezoid stages, ECharts-funnel parity
// mobject (see examples/echarts-parity/ref/07-funnel.js). Not an Axes-based
// chart like BarChart (probability.ts) — like PieChart (charts.ts) it lays
// out its own local coordinate space (origin at the chart's center) and is a
// plain VGroup.
//
// Each stage is a 4-vertex Polygon (geometry.ts) whose top edge width comes
// from THIS stage's value and whose bottom edge width comes from the NEXT
// stage's value (or its own, for the last stage) — the classic funnel taper.
// Stage widths map from value -> half-width via scaleLinear (core/scales.ts),
// same idea as d3/ECharts' minSize/maxSize percentage mapping.

import { VGroup } from "./VMobject.ts";
import { Polygon } from "./geometry.ts";
import { Text } from "./text/Text.ts";
import { scaleLinear } from "../core/scales.ts";
import { BLUE, YELLOW, RED, GREEN, PURPLE, ORANGE, TEAL, PINK, WHITE } from "../core/color.ts";
import type { ColorLike } from "../core/types.ts";

const DEFAULT_STAGE_COLORS: ColorLike[] = [BLUE, YELLOW, RED, GREEN, PURPLE, ORANGE, TEAL, PINK];

export interface FunnelStage {
  name: string;
  value: number;
}

export interface FunnelChartConfig {
  /** Total chart width in world units (default 4). */
  width?: number;
  /** Total chart height in world units (default 4). */
  height?: number;
  /** Stage ordering (default 'descending', matching ECharts' default). */
  sort?: "descending" | "ascending" | "none";
  /** Vertical gap between stages, world units (default 0.05). */
  gap?: number;
  /** Min stage width as a fraction of `width` (default 0 — ECharts' minSize: '0%'). */
  minSizeRatio?: number;
  /** Max stage width as a fraction of `width` (default 1 — ECharts' maxSize: '100%'). */
  maxSizeRatio?: number;
  /** Stage fill colors, cycled when there are more stages than colors. */
  colors?: ColorLike[];
  strokeColor?: ColorLike;
  strokeWidth?: number;
  fillOpacity?: number;
  /** Show a centered label inside each trapezoid (default true). */
  showLabels?: boolean;
  labelFontSize?: number;
  labelColor?: ColorLike;
}

interface StageLayout {
  corners: number[][];
  topHalfWidth: number;
  bottomHalfWidth: number;
  centerY: number;
}

/**
 * A funnel chart: one tapering trapezoid per stage, stacked top-to-bottom,
 * sorted by value (descending by default). `stages` (the Polygon trapezoids,
 * in SORTED/rendered order) and `labels` are addressable for per-stage
 * animation; `setStages()` rebuilds the geometry IN PLACE when the stage
 * count is unchanged — the Polygon mobjects keep their identity, so
 * updaters, Transforms, and references to `chart.stages[i]` stay valid.
 */
export class FunnelChart extends VGroup {
  stagesData: FunnelStage[];
  readonly stages: Polygon[] = [];
  readonly labels: Text[] = [];
  private readonly _config: FunnelChartConfig;
  private readonly _stagesGroup = new VGroup();
  private readonly _labelsGroup = new VGroup();

  constructor(stages: FunnelStage[], config: FunnelChartConfig = {}) {
    super();
    this.stagesData = [...stages];
    this._config = config;
    this.add(this._stagesGroup, this._labelsGroup);
    this._build();
  }

  // Stable sort (copies input, never mutates it) per `config.sort`.
  private _sortStages(stages: FunnelStage[]): FunnelStage[] {
    const { sort = "descending" } = this._config;
    if (sort === "none") return [...stages];
    const indexed = stages.map((s, i) => ({ s, i }));
    if (sort === "descending") {
      indexed.sort((a, b) => b.s.value - a.s.value || a.i - b.i);
    } else {
      indexed.sort((a, b) => a.s.value - b.s.value || a.i - b.i);
    }
    return indexed.map((x) => x.s);
  }

  private _layout(sorted: FunnelStage[]): StageLayout[] {
    const {
      width = 4, height = 4, gap = 0.05, minSizeRatio = 0, maxSizeRatio = 1,
    } = this._config;
    const n = sorted.length;
    if (n === 0) return [];
    const maxValue = Math.max(...sorted.map((s) => s.value), 0);
    const scale = scaleLinear(
      [0, maxValue || 1],
      [(width * minSizeRatio) / 2, (width * maxSizeRatio) / 2],
    );
    const halfWidths = sorted.map((s) => scale(s.value));
    const rowHeight = (height - gap * Math.max(0, n - 1)) / n;

    const out: StageLayout[] = [];
    let topY = height / 2;
    for (let i = 0; i < n; i++) {
      const bottomY = topY - rowHeight;
      const topHalfWidth = halfWidths[i];
      const bottomHalfWidth = i < n - 1 ? halfWidths[i + 1] : halfWidths[i];
      out.push({
        corners: [
          [-topHalfWidth, topY, 0],
          [topHalfWidth, topY, 0],
          [bottomHalfWidth, bottomY, 0],
          [-bottomHalfWidth, bottomY, 0],
        ],
        topHalfWidth,
        bottomHalfWidth,
        centerY: (topY + bottomY) / 2,
      });
      topY = bottomY - gap;
    }
    return out;
  }

  private _colorFor(index: number): ColorLike {
    const colors = this._config.colors ?? DEFAULT_STAGE_COLORS;
    if (!colors.length) return WHITE;
    return colors[index % colors.length];
  }

  private _makeStage(layout: StageLayout, i: number): Polygon {
    const { strokeColor, strokeWidth = 1, fillOpacity = 1 } = this._config;
    const color = this._colorFor(i);
    return new Polygon(layout.corners, {
      fillColor: color,
      fillOpacity,
      strokeColor: strokeColor ?? WHITE,
      strokeWidth,
    });
  }

  // Label text for a stage. Default: the stage name only (matching ECharts'
  // default inside label). Callers wanting "name: value" can build their own
  // labels off `stagesData`/`stages` instead.
  private _labelText(stage: FunnelStage): string {
    return stage.name;
  }

  private _buildLabels(sorted: FunnelStage[], layouts: StageLayout[]): void {
    const { showLabels = true, labelFontSize = 0.3, labelColor } = this._config;
    this._labelsGroup.submobjects.length = 0;
    this.labels.length = 0;
    if (!showLabels) return;
    sorted.forEach((stage, i) => {
      const layout = layouts[i];
      const label = new Text(this._labelText(stage), {
        fontSize: labelFontSize,
        ...(labelColor !== undefined ? { color: labelColor } : {}),
      });
      label.moveTo([0, layout.centerY, 0]);
      this.labels.push(label);
    });
    this._labelsGroup.add(...this.labels);
  }

  private _build(): void {
    const sorted = this._sortStages(this.stagesData);
    this.stagesData = sorted;
    const layouts = this._layout(sorted);
    layouts.forEach((layout, i) => {
      this.stages.push(this._makeStage(layout, i));
    });
    this._stagesGroup.add(...this.stages);
    this._buildLabels(sorted, layouts);
  }

  /**
   * Rebuild the chart from a new set of stages, in place. With the same
   * stage COUNT, each existing Polygon's points/subpathStarts are rewritten
   * (identity preserved — Transform-friendly); a changed count replaces the
   * stage list. Labels are always regenerated.
   */
  setStages(stages: FunnelStage[]): this {
    const sorted = this._sortStages(stages);
    this.stagesData = sorted;
    const layouts = this._layout(sorted);

    if (layouts.length === this.stages.length) {
      layouts.forEach((layout, i) => {
        this.stages[i].setPointsAsCorners([...layout.corners, layout.corners[0]]);
        this.stages[i].vertices = layout.corners;
      });
    } else {
      this._stagesGroup.submobjects.length = 0;
      this.stages.length = 0;
      layouts.forEach((layout, i) => this.stages.push(this._makeStage(layout, i)));
      this._stagesGroup.add(...this.stages);
    }
    this._buildLabels(sorted, layouts);
    return this;
  }
}

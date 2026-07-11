// ECharts parity demo 09: ref/09-calendar-heatmap.js — "Calendar Heatmap"
// (ECharts gallery, Apache-2.0). GitHub-style day-cell heatmap for one year
// (2016) on the `calendar` coordinate system, `visualMap: {type:'piecewise',
// min:0, max:10000}` bucketed cell color, data synthesized inline (the ref
// itself fabricates fake step-count data via Math.random()).
//
// Reproduced via the D3-parity campaign's calendar-view precedent
// (examples/d3-parity/10-calendar-view.ts): per-cell Rectangles positioned
// with utcMonday/utcYear/utcMonth interval math (src/core/format.ts),
// PolyLine month-boundary staircases, Text day/month/year labels. That demo
// pulls in `svgFrame`/`loadCsv` from its own `_run.ts`; this campaign's
// harness (../_run.ts) only exports `demoRender`/`loadJson` (no SVG-pixel
// gallery sources needed for this corpus), so the small SVG-pixel-space ->
// world-frame bridge is reproduced locally below instead of importing across
// campaigns.
//
// visualMap's `piecewise` binning is approximated with `scaleQuantize`
// (src/core/scales.ts, equal-width bins) rather than ECharts' own piecewise
// cutpoint algorithm -- documented "close enough" substitution per the task.
//
// Honest divergences: weeks are Monday-based (D3-parity precedent) rather
// than ECharts calendar's Sunday-first default -- a cosmetic row-order
// difference, not a data/shape divergence. `yearLabel: {show: false}` in the
// ref suppresses the calendar's own big year annotation; the year still
// appears in this demo's title text for orientation, which doesn't
// contradict that option (a different label).
//
// CRITICAL: this campaign's harness renders on a WHITE background and Text
// defaults to WHITE fill (see 06-gauge.ts's commit message) — every Text
// below is given an explicit dark color.

import {
  Scene, Rectangle, PolyLine, Text, VGroup, Legend,
  scaleQuantize, utcMonday, utcMonth, utcYear, utcFormat,
  LaggedStart, FadeIn,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const AXIS_COLOR = "#333333";

// Local SVG-pixel-space -> world-frame bridge (same technique as
// examples/d3-parity/_run.ts's svgFrame -- see header note on why it's
// reproduced here instead of imported).
function svgFrame(width: number, height: number) {
  const scale = Math.min(14.222 / width, 8 / height) * 0.92;
  return {
    pt: (x: number, y: number): number[] => [(x - width / 2) * scale, (height / 2 - y) * scale, 0],
    len: (n: number) => n * scale,
  };
}

// Deterministic PRNG standing in for the ref's own Math.random() synthetic
// data generator (getVirtualData), so re-renders are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const YEAR = 2016;
const rand = mulberry32(20160101);

// One Date + value per day of YEAR, value in [0, 10000) -- matches the ref's
// `Math.floor(Math.random() * 10000)`.
const yearStart = new Date(Date.UTC(YEAR, 0, 1));
const yearEnd = new Date(Date.UTC(YEAR + 1, 0, 1));
const days: Date[] = [];
for (let t = yearStart; t < yearEnd; t = new Date(t.getTime() + 86400000)) days.push(t);
const values = days.map(() => Math.floor(rand() * 10000));

// visualMap: {type:'piecewise', min:0, max:10000} approximated as 5
// equal-width bins (scaleQuantize).
const BUCKET_COLORS = ["#ebedf0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"];
const BUCKET_LABELS = ["0-2k", "2-4k", "4-6k", "6-8k", "8-10k"];
const color = scaleQuantize<string>([0, 10000], BUCKET_COLORS);

class CalendarHeatmap extends Scene {
  async construct() {
    const cellSize = 13, weekDays = 7;
    const countDay = (d: number) => (d + 6) % 7; // Monday-based weeks
    const timeWeek = utcMonday;
    const formatMonth = utcFormat("%b");

    const tx = 34, ty = 26;
    const width = tx + 54 * cellSize + 10;
    const height = ty + weekDays * cellSize + 10;
    const f = svgFrame(width, height);
    const fontSize = f.len(10);

    const cellAt = (w: number, d: number) =>
      f.pt(tx + w * cellSize + cellSize / 2, ty + d * cellSize + cellSize / 2);

    const cells = new VGroup();
    const decor = new VGroup();

    // Weekday row labels (S M T W T F S, Monday-based order).
    for (let i = 0; i < weekDays; i++) {
      const lab = new Text("SMTWTFS"[i], { fontSize, color: AXIS_COLOR });
      lab.moveTo(f.pt(tx - 8, ty + (countDay(i) + 0.5) * cellSize));
      decor.add(lab);
    }

    // Day cells.
    for (let i = 0; i < days.length; i++) {
      const w = timeWeek.count(utcYear.floor(days[i]), days[i]);
      const d = countDay(days[i].getUTCDay());
      const cell = new Rectangle({
        width: f.len(cellSize - 1.5),
        height: f.len(cellSize - 1.5),
        fillColor: color(values[i]),
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWidth: 1,
      });
      cell.moveTo(cellAt(w, d));
      cells.add(cell);
    }

    // Month boundaries (white staircase) + month labels.
    const months = utcMonth.range(utcMonth.floor(days[0]), days[days.length - 1]);
    months.forEach((m, mi) => {
      if (mi) {
        const d = countDay(m.getUTCDay());
        const w = timeWeek.count(utcYear.floor(m), m);
        const px = (wx: number, dy: number) => f.pt(tx + wx * cellSize, ty + dy * cellSize);
        const points = d === 0
          ? [px(w, 0), px(w, weekDays)]
          : [px(w + 1, 0), px(w + 1, d), px(w, d), px(w, weekDays)];
        decor.add(new PolyLine({ points, strokeColor: "#ffffff", strokeWidth: 3 }));
      }
      const lab = new Text(formatMonth(m), { fontSize, color: AXIS_COLOR });
      lab.moveTo(f.pt(tx + timeWeek.count(utcYear.floor(m), timeWeek.ceil(m)) * cellSize + 2, ty - 9));
      decor.add(lab);
    });

    const title = new Text("Daily Step Count", { fontSize: 0.42, color: AXIS_COLOR });
    title.moveTo([0, 3.3, 0]);
    const subtitle = new Text(String(YEAR), { fontSize: 0.24, color: AXIS_COLOR });
    subtitle.moveTo([0, 2.85, 0]);

    const legend = new Legend(
      BUCKET_LABELS.map((label, i) => ({ label, color: BUCKET_COLORS[i], shape: "rect" as const })),
      { orientation: "horizontal", itemSpacing: 1.15, swatchSize: 0.18, fontSize: 0.18, textColor: AXIS_COLOR },
    );
    legend.moveTo([0, 2.35, 0]);

    // Cells below, decorations above (matches D3-parity precedent's DOM
    // order), shifted down to make room for the title/legend header.
    const chart = new VGroup(cells, decor);
    chart.shift([0, -0.8, 0]);
    this.add(title, subtitle, legend, chart);

    await this.play(new LaggedStart(
      [new FadeIn(cells), new FadeIn(decor)],
      { lagRatio: 0.4, runTime: 2 },
    ));
    await this.wait(0.5);
  }
}

await demoRender(CalendarHeatmap, import.meta.url);

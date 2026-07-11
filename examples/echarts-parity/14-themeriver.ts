// ECharts parity demo 14: ref/14-themeriver.js — "ThemeRiver" (ECharts
// gallery, Apache-2.0). Streamgraph-style flowing river of 6 categories
// (DQ/TY/SS/QG/SY/DD) over 21 days (2015/11/08-2015/11/28). The ref's data
// is long/tidy triples `[date, value, category]`; pivoted into per-date wide
// rows the SAME way examples/d3-parity/08-streamgraph.ts pivots its
// date/industry/unemployed triples (see its pivot loop — this is that same
// pattern with category/value renamed), then fed through d3-shape's
// stack(). ECharts' themeRiver default look is a symmetric CENTERED band
// stack, closer to offset: "silhouette" than the streamgraph's own
// offset: "wiggle" choice — used here per assessment as the better visual
// match. Bottom time axis via axisBottom()/scaleUtc, matching the
// streamgraph demo's own axis convention (../d3-parity/_axes.ts).

import {
  Scene, Polygon, Legend, scaleUtc, scaleLinear, scaleOrdinal, extent,
  stack, areaGen, schemeTableau10, LaggedStart, FadeIn,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";
import { svgFrame } from "../d3-parity/_run.ts";
import { axisBottom } from "../d3-parity/_axes.ts";

// Long-format [date, value, category] triples, verbatim from ref/14-themeriver.js.
const raw: Array<[string, number, string]> = [
  ["2015/11/08", 10, "DQ"], ["2015/11/09", 15, "DQ"], ["2015/11/10", 35, "DQ"],
  ["2015/11/11", 38, "DQ"], ["2015/11/12", 22, "DQ"], ["2015/11/13", 16, "DQ"],
  ["2015/11/14", 7, "DQ"], ["2015/11/15", 2, "DQ"], ["2015/11/16", 17, "DQ"],
  ["2015/11/17", 33, "DQ"], ["2015/11/18", 40, "DQ"], ["2015/11/19", 32, "DQ"],
  ["2015/11/20", 26, "DQ"], ["2015/11/21", 35, "DQ"], ["2015/11/22", 40, "DQ"],
  ["2015/11/23", 32, "DQ"], ["2015/11/24", 26, "DQ"], ["2015/11/25", 22, "DQ"],
  ["2015/11/26", 16, "DQ"], ["2015/11/27", 22, "DQ"], ["2015/11/28", 10, "DQ"],
  ["2015/11/08", 35, "TY"], ["2015/11/09", 36, "TY"], ["2015/11/10", 37, "TY"],
  ["2015/11/11", 22, "TY"], ["2015/11/12", 24, "TY"], ["2015/11/13", 26, "TY"],
  ["2015/11/14", 34, "TY"], ["2015/11/15", 21, "TY"], ["2015/11/16", 18, "TY"],
  ["2015/11/17", 45, "TY"], ["2015/11/18", 32, "TY"], ["2015/11/19", 35, "TY"],
  ["2015/11/20", 30, "TY"], ["2015/11/21", 28, "TY"], ["2015/11/22", 27, "TY"],
  ["2015/11/23", 26, "TY"], ["2015/11/24", 15, "TY"], ["2015/11/25", 30, "TY"],
  ["2015/11/26", 35, "TY"], ["2015/11/27", 42, "TY"], ["2015/11/28", 42, "TY"],
  ["2015/11/08", 21, "SS"], ["2015/11/09", 25, "SS"], ["2015/11/10", 27, "SS"],
  ["2015/11/11", 23, "SS"], ["2015/11/12", 24, "SS"], ["2015/11/13", 21, "SS"],
  ["2015/11/14", 35, "SS"], ["2015/11/15", 39, "SS"], ["2015/11/16", 40, "SS"],
  ["2015/11/17", 36, "SS"], ["2015/11/18", 33, "SS"], ["2015/11/19", 43, "SS"],
  ["2015/11/20", 40, "SS"], ["2015/11/21", 34, "SS"], ["2015/11/22", 28, "SS"],
  ["2015/11/23", 26, "SS"], ["2015/11/24", 37, "SS"], ["2015/11/25", 41, "SS"],
  ["2015/11/26", 46, "SS"], ["2015/11/27", 47, "SS"], ["2015/11/28", 41, "SS"],
  ["2015/11/08", 10, "QG"], ["2015/11/09", 15, "QG"], ["2015/11/10", 35, "QG"],
  ["2015/11/11", 38, "QG"], ["2015/11/12", 22, "QG"], ["2015/11/13", 16, "QG"],
  ["2015/11/14", 7, "QG"], ["2015/11/15", 2, "QG"], ["2015/11/16", 17, "QG"],
  ["2015/11/17", 33, "QG"], ["2015/11/18", 40, "QG"], ["2015/11/19", 32, "QG"],
  ["2015/11/20", 26, "QG"], ["2015/11/21", 35, "QG"], ["2015/11/22", 40, "QG"],
  ["2015/11/23", 32, "QG"], ["2015/11/24", 26, "QG"], ["2015/11/25", 22, "QG"],
  ["2015/11/26", 16, "QG"], ["2015/11/27", 22, "QG"], ["2015/11/28", 10, "QG"],
  ["2015/11/08", 10, "SY"], ["2015/11/09", 15, "SY"], ["2015/11/10", 35, "SY"],
  ["2015/11/11", 38, "SY"], ["2015/11/12", 22, "SY"], ["2015/11/13", 16, "SY"],
  ["2015/11/14", 7, "SY"], ["2015/11/15", 2, "SY"], ["2015/11/16", 17, "SY"],
  ["2015/11/17", 33, "SY"], ["2015/11/18", 40, "SY"], ["2015/11/19", 32, "SY"],
  ["2015/11/20", 26, "SY"], ["2015/11/21", 35, "SY"], ["2015/11/22", 4, "SY"],
  ["2015/11/23", 32, "SY"], ["2015/11/24", 26, "SY"], ["2015/11/25", 22, "SY"],
  ["2015/11/26", 16, "SY"], ["2015/11/27", 22, "SY"], ["2015/11/28", 10, "SY"],
  ["2015/11/08", 10, "DD"], ["2015/11/09", 15, "DD"], ["2015/11/10", 35, "DD"],
  ["2015/11/11", 38, "DD"], ["2015/11/12", 22, "DD"], ["2015/11/13", 16, "DD"],
  ["2015/11/14", 7, "DD"], ["2015/11/15", 2, "DD"], ["2015/11/16", 17, "DD"],
  ["2015/11/17", 33, "DD"], ["2015/11/18", 4, "DD"], ["2015/11/19", 32, "DD"],
  ["2015/11/20", 26, "DD"], ["2015/11/21", 35, "DD"], ["2015/11/22", 40, "DD"],
  ["2015/11/23", 32, "DD"], ["2015/11/24", 26, "DD"], ["2015/11/25", 22, "DD"],
  ["2015/11/26", 16, "DD"], ["2015/11/27", 22, "DD"], ["2015/11/28", 10, "DD"],
];

class ThemeRiver extends Scene {
  async construct() {
    const width = 928, height = 600;
    const marginTop = 70, marginRight = 40, marginBottom = 50, marginLeft = 40;
    const f = svgFrame(width, height);

    // Pivot long rows -> one wide row per date (keys = categories in
    // first-appearance order, matching the ECharts legend's `data` order).
    const keys: string[] = [];
    const byDate = new Map<number, Record<string, any>>();
    for (const [dateStr, value, category] of raw) {
      if (!keys.includes(category)) keys.push(category);
      const date = new Date(dateStr);
      let row = byDate.get(+date);
      if (!row) byDate.set(+date, (row = { date }));
      row[category] = value;
    }
    const rows = [...byDate.values()].sort((a, b) => +a.date - +b.date);

    const series = stack({ keys, offset: "silhouette" })(rows);

    const x = scaleUtc(extent(rows, (d) => +d.date), [marginLeft, width - marginRight]);
    const y = scaleLinear(
      extent(series.flat(2) as unknown as number[]),
      [height - marginBottom, marginTop],
    );
    const color = scaleOrdinal(keys, schemeTableau10);

    const area = areaGen<[number, number]>({
      x: (_d, i) => x(+rows[i].date),
      y0: ([y0]) => y(y0),
      y1: ([, y1]) => y(y1),
    });

    const bands = series.map((s) => {
      const ring = area(s as unknown as Array<[number, number]>)[0];
      return new Polygon(
        ring.map(([px, py]) => f.pt(px, py)),
        // Hairline same-color stroke seals antialiasing seams between bands
        // (same trick as the streamgraph port).
        { fillColor: color(s.key), fillOpacity: 1, strokeColor: color(s.key), strokeWidth: f.sw(1) },
      );
    });

    this.add(axisBottom(x, height - marginBottom, f, {
      tickCount: Math.round(width / 100), format: x.tickFormat(), noDomain: true,
    }));

    // Legend (data order matches the ECharts option's `legend.data`), placed
    // top-center like the ref's `legend: {top: 15}`. textColor is explicit
    // dark — Legend's Text labels default to WHITE (invisible on this
    // campaign's white demo background) when textColor is omitted.
    const legend = new Legend(
      keys.map((k) => ({ label: k, color: color(k) })),
      { orientation: "horizontal", itemSpacing: 0.85, swatchSize: 0.18, fontSize: 0.22, textColor: "#333333" },
    );
    legend.moveTo(f.pt(width / 2, 22));
    this.add(legend);

    await this.play(new LaggedStart(
      bands.map((b) => new FadeIn(b, { shift: [0, f.len(30), 0] })),
      { lagRatio: 0.12, runTime: 2.5 },
    ));
    await this.wait(0.5);
  }
}

await demoRender(ThemeRiver, import.meta.url);

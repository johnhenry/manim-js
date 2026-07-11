// ECharts parity demo 03: ref/03-bar-stack.js — "Stacked Column Chart"
// (ECharts gallery, Apache-2.0). Multi-series bars stacked per category via
// matching `stack` keys. Reproduced with the D3-campaign stack()+
// scaleBand()+Rectangle pattern from
// examples/d3-parity/03-stacked-to-grouped-bars.ts (stack() from
// src/mobject/shape_gen.ts): one stack({keys:[...]}) call per stack-group in
// the ECharts data -- 2 calls, 'Ad' (Email/Union Ads/Video Ads) and
// 'Search Engine' (Baidu/Google/Bing/Others) -- plus 'Direct' rendered as an
// unstacked series beside them.
//
// Divergence: the ref ALSO has a `Search Engine` series (data [862, 1018,
// ...]) with no `stack` key of its own -- it's a near-duplicate TOTAL of the
// Baidu+Google+Bing+Others breakdown (862 = 620+120+60+62 for Monday, etc.)
// rendered as its own wide bar beside a THIN overlaid `stack: 'Search
// Engine'` breakdown (`barWidth: 5` on 'Baidu'). Per the porting brief this
// redundant total series is dropped: the 'Search Engine' stack group here
// IS the visible Search-Engine bar, and the ref's markLine (dashed min/max
// connector, originally attached to the dropped total series) is rebuilt
// from that same stack group's per-day totals -- values are identical
// either way. markLine itself is a DashedLine (src/mobject/geometry.ts)
// between the computed min/max points, since Line/VMobject has no native
// per-mobject dash style beyond the DashedLine subclass.

import {
  Scene, Rectangle, DashedLine, Line, Text, Legend, Create, scaleBand, scaleLinear,
  stack, rangeOf, max, AnimationGroup, tweenTo,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const LABEL_COLOR = "#333333";
const COLORS: Record<string, string> = {
  Direct: "#5470c6",
  Email: "#91cc75",
  "Union Ads": "#fac858",
  "Video Ads": "#ee6666",
  Baidu: "#73c0de",
  Google: "#3ba272",
  Bing: "#fc8452",
  Others: "#9a60b4",
};

function svgFrame(width: number, height: number) {
  const scale = Math.min(14.222 / width, 8 / height) * 0.92;
  return {
    pt: (x: number, y: number): number[] => [(x - width / 2) * scale, (height / 2 - y) * scale, 0],
    len: (n: number): number => n * scale,
    sw: (n: number): number => n * scale * 135,
  };
}

class BarStack extends Scene {
  async construct() {
    const width = 700, height = 460;
    const marginTop = 80, marginBottom = 40, marginLeft = 20, marginRight = 20;
    const f = svgFrame(width, height);

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const m = days.length;
    const direct = [320, 332, 301, 334, 390, 330, 320];
    const email = [120, 132, 101, 134, 90, 230, 210];
    const unionAds = [220, 182, 191, 234, 290, 330, 310];
    const videoAds = [150, 232, 201, 154, 190, 330, 410];
    const baidu = [620, 732, 701, 734, 1090, 1130, 1120];
    const google = [120, 132, 101, 134, 290, 230, 220];
    const bing = [60, 72, 71, 74, 190, 130, 110];
    const others = [62, 82, 91, 84, 109, 110, 120];

    const adKeys = ["Email", "Union Ads", "Video Ads"];
    const adRows = rangeOf(m).map((j) => ({ Email: email[j], "Union Ads": unionAds[j], "Video Ads": videoAds[j] }));
    const adStack = stack({ keys: adKeys })(adRows);

    const seKeys = ["Baidu", "Google", "Bing", "Others"];
    const seRows = rangeOf(m).map((j) => ({ Baidu: baidu[j], Google: google[j], Bing: bing[j], Others: others[j] }));
    const seStack = stack({ keys: seKeys })(seRows);

    const adTotals = rangeOf(m).map((j) => adStack[adKeys.length - 1][j][1]);
    const seTotals = rangeOf(m).map((j) => seStack[seKeys.length - 1][j][1]);
    const yMaxRaw = Math.max(max(direct), max(adTotals), max(seTotals));
    const yMax = Math.ceil(yMaxRaw / 200) * 200;

    // Layout: 7 day-slots, each holding 3 grouped columns (Direct / Ad / SE).
    const xDay = scaleBand(rangeOf(m), [marginLeft, width - marginRight]).padding(0.2);
    const xCol = scaleBand(rangeOf(3), [0, xDay.bandwidth()]).padding(0.12);
    const y = scaleLinear([0, yMax], [height - marginBottom, marginTop]);
    const colW = xCol.bandwidth();

    type Seg = { key: string; color: string; col: number; day: number; y0: number; y1: number };
    const segs: Seg[] = [];
    for (let j = 0; j < m; j++) {
      segs.push({ key: "Direct", color: COLORS.Direct, col: 0, day: j, y0: 0, y1: direct[j] });
      adKeys.forEach((k, si) => {
        const [y0, y1] = adStack[si][j];
        segs.push({ key: k, color: COLORS[k], col: 1, day: j, y0, y1 });
      });
      seKeys.forEach((k, si) => {
        const [y0, y1] = seStack[si][j];
        segs.push({ key: k, color: COLORS[k], col: 2, day: j, y0, y1 });
      });
    }

    const colCenterPx = (day: number, col: number) => xDay(day) + xCol(col) + colW / 2;

    // Bars grow in from the baseline (height ~0) up to their final stacked
    // extents, staggered slightly per day column.
    const rects = segs.map((s) => {
      const cxPx = colCenterPx(s.day, s.col);
      const cyPxFinal = (y(s.y1) + y(s.y0)) / 2;
      const hPxFinal = Math.max(0.01, y(s.y0) - y(s.y1));
      const rect = new Rectangle({
        width: f.len(colW), height: f.len(0.01),
        fillColor: s.color, fillOpacity: 1, strokeWidth: 0,
      });
      rect.moveTo(f.pt(cxPx, height - marginBottom));
      return { rect, s, cxPx, cyPxFinal, hPxFinal };
    });
    this.add(...rects.map((r) => r.rect));

    // Axis: baseline + day category labels + a few y gridline labels.
    const y0px = height - marginBottom;
    this.add(new Line(f.pt(marginLeft, y0px), f.pt(width - marginRight, y0px), { color: "#999999", strokeColor: "#999999", strokeWidth: f.sw(1) }));
    const dayLabels = days.map((d, j) => {
      const t = new Text(d, { fontSize: 0.26, color: LABEL_COLOR });
      const p = f.pt(xDay(j) + xDay.bandwidth() / 2, y0px + 18);
      t.moveTo(p);
      return t;
    });
    this.add(...dayLabels);
    const yTicks = [0, yMax / 2, yMax];
    const yTickLabels = yTicks.map((v) => {
      const t = new Text(String(v), { fontSize: 0.22, color: LABEL_COLOR });
      const p = f.pt(marginLeft - 14, y(v));
      t.moveTo(p);
      return t;
    });
    this.add(...yTickLabels);

    // markLine: dashed connector between the Search-Engine group's min and
    // max day totals (ref's markLine data: [[{type:'min'}, {type:'max'}]]).
    let minJ = 0, maxJ = 0;
    for (let j = 1; j < m; j++) {
      if (seTotals[j] < seTotals[minJ]) minJ = j;
      if (seTotals[j] > seTotals[maxJ]) maxJ = j;
    }
    const markStart = f.pt(colCenterPx(minJ, 2), y(seTotals[minJ]));
    const markEnd = f.pt(colCenterPx(maxJ, 2), y(seTotals[maxJ]));
    const markLine = new DashedLine(markStart, markEnd, { color: "#555555", strokeColor: "#555555", strokeWidth: f.sw(1.5) });

    const title = new Text("Stacked Column Chart", { fontSize: 0.36, weight: "bold", color: LABEL_COLOR });
    title.moveTo(f.pt(width / 2, 10));
    this.addForegroundMobject(title);

    // Two rows (Direct+Ad, then Search Engine breakdown) -- 8 items at once
    // overflowed the frame edges with the spacing a single row needs to stay
    // legible.
    const legendRow1 = [{ label: "Direct", color: COLORS.Direct }, ...adKeys.map((k) => ({ label: k, color: COLORS[k] }))];
    const legendRow2 = seKeys.map((k) => ({ label: k, color: COLORS[k] }));
    const legendConfig = { orientation: "horizontal" as const, textColor: LABEL_COLOR, fontSize: 0.2, itemSpacing: 0.45, swatchSize: 0.16 };
    const legend1 = new Legend(legendRow1, legendConfig);
    legend1.moveTo(f.pt(width / 2, 36));
    const legend2 = new Legend(legendRow2, legendConfig);
    legend2.moveTo(f.pt(width / 2, 55));
    this.addForegroundMobject(legend1, legend2);

    const grow = new AnimationGroup(rects.map(({ rect, s, cxPx, cyPxFinal, hPxFinal }) =>
      tweenTo(rect, {}, s.day * 0.05).to({ y: f.pt(0, cyPxFinal)[1], height: f.len(hPxFinal) }, 0.7)
    ));
    await this.play(grow);
    await this.play(new Create(markLine));
    await this.wait(1);
  }
}

await demoRender(BarStack, import.meta.url);

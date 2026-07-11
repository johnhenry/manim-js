// ECharts parity demo 02: ref/02-line-area-smooth.js — "Area Chart with Time
// Axis" (ECharts gallery, Apache-2.0). `smooth: true` line + `areaStyle: {}`
// fill on a single time-axis series. Uses ecmanim's Axes
// (src/mobject/coordinate_systems.ts) for the world-space frame: the x-axis
// is DATA-numeric (day-index 0..N-1, since Axes/NumberLine map plain
// numbers, not Date objects) while scaleUtc/scaleTime supplies the "nice"
// tick Date values + formatter, mirroring ECharts' own automatic time-axis
// labeling. The smoothed line uses axes.plotLineGraph(xs, ys, { smooth:
// true, addVertexDots: false }) (confirmed present below -- this option
// was just added, wiring VMobject.setPointsSmoothly in). The area fill
// uses areaGen() (src/mobject/shape_gen.ts) over the same discrete data
// points as the line, matching examples/d3-parity/08-streamgraph.ts:44's
// pattern -- picked over axes.getArea()'s continuous-function sampling
// since the source data is a discrete (if evenly-spaced) time series, not
// a closed-form function; areaGen keeps the fill's vertices in lockstep
// with the line's own data points.
//
// Divergence: the ref generates 20000 daily points and layers tooltip/
// toolbox/dataZoom (all interaction-only, no static visual). This port
// keeps N=150 points (readable at demo scale) and renders only the static
// chart: title, smoothed area+line, and a time-formatted x-axis + numeric
// y-axis.

import { Scene, Axes, Polygon, Text, Create, FadeIn, areaGen, scaleUtc, useRandom } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const LABEL_COLOR = "#333333";
const LINE_COLOR = "#5470c6";

class AreaTimeAxis extends Scene {
  async construct() {
    const N = 150;
    const rng = useRandom(11);
    const baseDate = new Date(Date.UTC(1988, 9, 3));
    const oneDay = 86_400_000;

    // ref: data = [[base, rand(0,300)]]; then random-walk += rand(-10,10),
    // clamped >= 0 for a readable area fill.
    const values: number[] = [Math.round(rng.nextFloat() * 300)];
    for (let i = 1; i < N; i++) {
      const v = Math.round((rng.nextFloat() - 0.5) * 20 + values[i - 1]);
      values.push(Math.max(0, v));
    }
    const dates = values.map((_v, i) => new Date(baseDate.getTime() + i * oneDay));
    const xs = values.map((_v, i) => i); // day-index domain for Axes
    const yMaxRaw = Math.max(...values);
    const yMax = Math.ceil(yMaxRaw / 50) * 50 || 50;

    const axes = new Axes({
      xRange: [0, N - 1, Math.ceil((N - 1) / 6)],
      yRange: [0, yMax, yMax / 5],
      xLength: 11,
      yLength: 5.5,
      color: LABEL_COLOR,
      xAxisConfig: { includeNumbers: false },
      yAxisConfig: { includeNumbers: false, fontSize: 0.28 },
    });
    this.add(axes);

    // Y-axis numbers: NOT via yAxisConfig.includeNumbers -- NumberLine
    // builds its numbers assuming a HORIZONTAL line, then Axes rotates the
    // whole y-axis 90 degrees, which drags the number labels along and
    // leaves them offset in the wrong direction (misplaced into the plot
    // area instead of to the axis's left). Axes.addCoordinates() works
    // around this for its own y-branch by building free-standing labels
    // from live coordsToPoint() instead; replicated here since
    // addCoordinates() itself would also force default numeric x labels,
    // which this demo replaces with time-formatted ones below.
    const yTickLabels = axes.yAxis.getTickRange()
      .filter((v) => Math.abs(v) > 1e-9)
      .map((v) => {
        const p = axes.coordsToPoint(0, v);
        const label = new Text(String(v), { fontSize: 0.28, color: LABEL_COLOR });
        label.moveTo([p[0] - 0.35, p[1], 0]);
        return label;
      });
    this.add(...yTickLabels);

    // Custom time-axis labels: scaleUtc supplies "nice" tick Dates + a
    // multi-scale formatter (ECharts' own auto time-axis behavior); Axes
    // maps each tick's day-index back to a world point.
    const time = scaleUtc([dates[0], dates[N - 1]]);
    const fmt = time.tickFormat();
    const tickLabels = time.ticks(6).map((d) => {
      const dayIndex = (d.getTime() - baseDate.getTime()) / oneDay;
      const p = axes.coordsToPoint(dayIndex, 0);
      const label = new Text(fmt(d), { fontSize: 0.24, color: LABEL_COLOR });
      label.moveTo([p[0], p[1] - 0.35, 0]);
      return label;
    });
    this.add(...tickLabels);

    const title = new Text("Large Area Chart", { fontSize: 0.4, weight: "bold", color: LABEL_COLOR });
    title.moveTo([0, 4.3, 0]);
    this.addForegroundMobject(title);

    // Area fill: closed ring through the same discrete points the line
    // uses, in WORLD coordinates directly (Axes.coordsToPoint already maps
    // data -> world, so areaGen's x/y0/y1 accessors just read that off).
    const area = areaGen<number>({
      x: (_v, i) => axes.coordsToPoint(xs[i], 0)[0],
      y0: () => axes.coordsToPoint(0, 0)[1],
      y1: (v) => axes.coordsToPoint(0, v)[1],
    });
    const ring = area(values)[0];
    const areaPoly = new Polygon(ring, { fillColor: LINE_COLOR, fillOpacity: 0.25, strokeWidth: 0 });

    // Smoothed line through the same points (the campaign's just-added
    // `smooth` option on plotLineGraph).
    const lineGroup = axes.plotLineGraph(xs, values, {
      smooth: true,
      addVertexDots: false,
      lineColor: LINE_COLOR,
    });

    await this.play(new FadeIn(areaPoly), new Create(lineGroup));
    await this.wait(1);
  }
}

await demoRender(AreaTimeAxis, import.meta.url);

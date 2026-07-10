// Showcase parity: AnimStats — animated statistics/dashboard videos.
// Proves: statCounter template (ValueTracker-driven count-up), BarChart with
// staggered bar reveal, PieChart via the chartReveal template, and an Axes
// plotLineGraph with a shaded getArea region.

import {
  Scene, Text, Axes, BarChart, PieChart, FadeIn, FadeOut, Write, LaggedStart,
  statCounter, chartReveal,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class AnimStats extends Scene {
  async construct() {
    const title = new Text("2026 in numbers", { fontSize: 0.8, color: "#F5F6F8", point: [0, 3.3, 0] });
    await this.play(new Write(title), { runTime: 0.8 });

    // Count-up hero stat.
    const stat = statCounter("renders served", 128450, { theme: "midnight", point: [0, 1.4, 0] });
    this.add(stat.group);
    await this.play(stat.animateIn(), { runTime: 0.5 });
    await this.play(stat.playThrough(1.8));
    await this.wait(0.3);

    // Bar chart, bars staggered in.
    const bars = new BarChart([4.2, 6.8, 9.1, 12.4], {
      barNames: ["Q1", "Q2", "Q3", "Q4"],
      yLength: 3, xLength: 4.5,
    });
    bars.scale(0.75).moveTo([-3.8, -1.6, 0]);
    this.add(bars);
    const barReveal = chartReveal(bars, { lagRatio: 0.2 });
    await this.play(barReveal.animateIn(), { runTime: 1.4 });

    // Donut share-of-traffic pie.
    const pie = new PieChart([46, 31, 23], {
      radius: 1.4, innerRadius: 0.7, gapAngle: 0.04, labels: true, labelFontSize: 0.3,
    });
    pie.moveTo([3.9, -1.6, 0]);
    this.add(pie);
    await this.play(chartReveal(pie, { lagRatio: 0.25 }).animateIn(), { runTime: 1.2 });

    // Growth curve with shaded area.
    const axes = new Axes({ xRange: [0, 12, 3], yRange: [0, 10, 5], xLength: 4, yLength: 2.2 });
    axes.moveTo([0.1, -1.7, 0]).scale(0.9);
    const curve = axes.plot((x: number) => 1.2 + 0.06 * x * x, { color: "#83C167" });
    const area = axes.getArea(curve, { xRange: [0, 12], color: "#83C167", opacity: 0.25 });
    await this.play(new FadeIn(axes), { runTime: 0.5 });
    await this.play(new LaggedStart([new FadeIn(curve), new FadeIn(area)], { lagRatio: 0.4 }), { runTime: 1.0 });

    await this.wait(1.2);
    await this.play(
      new LaggedStart(
        [stat.group, bars, pie, axes, curve, area, title].map((m: any) => new FadeOut(m)),
        { lagRatio: 0.05 },
      ),
      { runTime: 1.0 },
    );
  }
}

await demoRender(AnimStats, import.meta.url, { background: "#101216" });

// Showcase parity: Mux — data-driven video reports (per-customer renders).
// Proves: schema-validated scene params reaching construct() (scene.params),
// a committed API-shaped JSON fixture as the data source, PieChart donut +
// statCounter KPIs, and the SAME scene rendered twice with different params.

import { readFileSync } from "node:fs";
import {
  Scene, Text, PieChart, FadeIn, FadeOut, Write, LaggedStart,
  statCounter, defineSchema,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const DATA = JSON.parse(readFileSync(new URL("./assets/mux-metrics.json", import.meta.url), "utf8"));

class MuxReport extends Scene {
  static schema = defineSchema({
    org: { type: "enum", values: ["acme", "globex"], default: "acme" },
  });

  async construct() {
    const org = DATA.orgs[this.params.org ?? "acme"];
    const title = new Text(`${org.name} — weekly QoS`, { fontSize: 0.7, color: "#F5F6F8", point: [0, 3.2, 0] });
    await this.play(new Write(title), { runTime: 0.8 });

    const pie = new PieChart(org.playbackShare, {
      radius: 1.7, innerRadius: 0.85, gapAngle: 0.05,
      labels: org.playbackLabels, labelFontSize: 0.32,
    });
    pie.moveTo([-3.6, -0.6, 0]);
    const pieLabel = new Text("playback share", { fontSize: 0.38, color: "#9AA3AF", point: [-3.6, -3.0, 0] });
    this.add(pie);
    await this.play(
      new LaggedStart(pie.slices.map((s) => new FadeIn(s, { scale: 0.8 })), { lagRatio: 0.25 }),
      new FadeIn(pieLabel),
      { runTime: 1.2 },
    );

    const views = statCounter("views", org.kpis.views, { theme: "midnight", point: [2.6, 1.0, 0] });
    const minutes = statCounter("watch minutes", org.kpis.watchMinutes, { theme: "midnight", point: [2.6, -1.2, 0] });
    const rebuffer = statCounter("rebuffer %", org.kpis.rebufferPct, {
      theme: { preset: "midnight", accent: "#FC6255" }, decimals: 2, point: [2.6, -3.0, 0],
    });
    for (const kpi of [views, minutes, rebuffer]) this.add(kpi.group);
    await this.play(new LaggedStart([views, minutes, rebuffer].map((k) => k.animateIn()), { lagRatio: 0.2 }));
    await this.play(views.playThrough(1.6), minutes.playThrough(1.6), rebuffer.playThrough(1.6));
    await this.wait(1.2);
    await this.play(
      new FadeOut(pie), new FadeOut(pieLabel), new FadeOut(title),
      ...[views, minutes, rebuffer].map((k) => k.animateOut()),
      { runTime: 0.8 },
    );
  }
}

// The Mux move: one scene, many customers — two param-driven renders.
await demoRender(MuxReport, import.meta.url, { background: "#101216", params: { org: "acme" }, suffix: "-acme" });
await demoRender(MuxReport, import.meta.url, { background: "#101216", params: { org: "globex" }, suffix: "-globex" });

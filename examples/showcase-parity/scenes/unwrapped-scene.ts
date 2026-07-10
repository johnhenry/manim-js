// The GitHub-Unwrapped scene rendered by the render service (see
// 05-github-unwrapped.ts). Fully parameterized: the service submits five
// different `params` against this ONE deployed module.

import {
  Scene, Text, VGroup, Square, PieChart, FadeIn, FadeOut, LaggedStart,
  defineSchema, titleCard, statCounter, outroCard, mulberry32,
} from "../../../src/node.ts";

export default class Unwrapped extends Scene {
  static schema = defineSchema({
    user: { type: "string", default: "octocat" },
    commits: { type: "number", default: 1000 },
    prs: { type: "number", default: 50 },
    topLang: { type: "string", default: "TypeScript" },
    langA: { type: "number", default: 60 },
    langB: { type: "number", default: 25 },
    langC: { type: "number", default: 15 },
  });

  async construct() {
    const { user, commits, prs, topLang, langA, langB, langC } = this.params;
    const langs: number[] = [langA, langB, langC];

    // Title.
    const card = titleCard(`@${user}'s 2026`, { subtitle: "Unwrapped", theme: "midnight" });
    await this.play(card.animateIn());
    await this.wait(0.5);
    await this.play(card.animateOut(), { runTime: 0.5 });

    // Contribution grid: 26 weeks x 7 days, seeded per user.
    const rand = mulberry32([...String(user)].reduce((a, c) => a + c.charCodeAt(0), 7));
    const grid = new VGroup();
    for (let w = 0; w < 26; w++) {
      for (let d = 0; d < 7; d++) {
        const level = rand();
        const green = level < 0.3 ? "#1B2A1F" : level < 0.6 ? "#2E5E3A" : level < 0.85 ? "#48A05F" : "#6FE08A";
        grid.add(new Square({ sideLength: 0.19, color: green, fillOpacity: 1, strokeWidth: 0, point: [-3.2 + w * 0.26, 1.9 - d * 0.26, 0] }));
      }
    }
    const gridLabel = new Text("your year in commits", { fontSize: 0.36, color: "#9AA3AF", point: [0, 2.6, 0] });
    await this.play(new FadeIn(gridLabel), { runTime: 0.4 });
    await this.play(
      new LaggedStart(grid.submobjects.map((sq) => new FadeIn(sq, { scale: 0.4 })), { lagRatio: 0.004 }),
      { runTime: 1.6 },
    );

    // Stats count up side by side.
    const commitStat = statCounter("commits", commits, { theme: "midnight", point: [-2.6, -1.9, 0] });
    const prStat = statCounter("pull requests", prs, { theme: "midnight", point: [2.6, -1.9, 0] });
    this.add(commitStat.group, prStat.group);
    await this.play(commitStat.animateIn(), prStat.animateIn(), { runTime: 0.4 });
    await this.play(commitStat.playThrough(1.4), prStat.playThrough(1.4));
    await this.wait(0.5);

    // Language donut.
    await this.play(new FadeOut(grid), new FadeOut(gridLabel), commitStat.animateOut(), prStat.animateOut(), { runTime: 0.6 });
    const pie = new PieChart(langs, {
      radius: 1.7, innerRadius: 0.9, gapAngle: 0.05,
      labels: [topLang, "and", "more"], labelFontSize: 0.3,
    });
    pie.moveTo([0, 0.5, 0]);
    this.add(pie);
    const langLabel = new Text(`${topLang} led the way`, { fontSize: 0.44, color: "#F5F6F8", point: [0, -2.2, 0] });
    await this.play(
      new LaggedStart(pie.slices.map((s) => new FadeIn(s, { scale: 0.8 })), { lagRatio: 0.25 }),
      new FadeIn(langLabel),
      { runTime: 1.1 },
    );
    await this.wait(0.7);
    await this.play(new FadeOut(pie), new FadeOut(langLabel), { runTime: 0.5 });

    // Outro.
    const outro = outroCard("See you in 2027", { handle: `@${user}`, theme: "midnight" });
    await this.play(outro.animateIn());
    await this.wait(0.8);
    await this.play(outro.animateOut(), { runTime: 0.5 });
  }
}

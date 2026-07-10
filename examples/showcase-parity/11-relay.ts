// Showcase parity: Relay.app explainer — SaaS workflow walkthroughs.
// Proves: FlexGroup (Yoga flexbox) card layout, spring-timed staggered card
// entrances, Create()'d connector arrows between workflow steps, and a
// slide() page transition into a closing screen.

import {
  Scene, FlexGroup, VGroup, RoundedRectangle, Circle, Text, Line,
  FadeIn, Create, Write, LaggedStart, slide, springTiming,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

function stepCard(label: string, accent: string): VGroup {
  const card = new RoundedRectangle({ width: 2.6, height: 1.5, cornerRadius: 0.2, color: "#1E242C", fillOpacity: 1, strokeWidth: 0 });
  const chip = new Circle({ radius: 0.16, color: accent, fillOpacity: 1, strokeWidth: 0 });
  chip.moveTo([-0.9, 0.35, 0]);
  const text = new Text(label, { fontSize: 0.26, color: "#F5F6F8" });
  text.moveTo([0, -0.25, 0]);
  const group = new VGroup(card, chip, text);
  return group;
}

class Relay extends Scene {
  async construct() {
    const title = new Text("When a lead signs up...", { fontSize: 0.62, color: "#F5F6F8", point: [0, 3.2, 0] });
    await this.play(new Write(title), { runTime: 0.8 });

    // Workflow cards laid out by Yoga flexbox.
    const row = new FlexGroup({ direction: "row", gap: 0.9, justifyContent: "center", alignItems: "center" });
    const cards = [
      stepCard("New signup", "#58C4DD"),
      stepCard("Enrich lead", "#FFD700"),
      stepCard("Notify sales", "#83C167"),
    ];
    for (const c of cards) row.add(c);
    await row.layout();
    row.moveTo([0, 0.6, 0]);

    // Spring-staggered entrance.
    const timing = springTiming({ mass: 1, damping: 12, stiffness: 120 }, undefined);
    const { rateFunc, runTime } = timing({ fps: this.fps });
    this.add(row);
    await this.play(
      new LaggedStart(cards.map((c) => new FadeIn(c, { shift: [0, -0.55, 0], scale: 0.8 })), { lagRatio: 0.25, rateFunc }),
      { runTime: Math.min(runTime ?? 1.6, 2.0) },
    );

    // Connector arrows drawn between the flex-laid-out cards.
    const connectors = new VGroup();
    for (let i = 0; i < cards.length - 1; i++) {
      const a = cards[i].getBoundingBox();
      const b = cards[i + 1].getBoundingBox();
      const y = cards[i].getCenter()[1];
      connectors.add(new Line([a.max[0] + 0.08, y, 0], [b.min[0] - 0.08, y, 0], { color: "#9AA3AF", strokeWidth: 5 }));
    }
    await this.play(new LaggedStart(connectors.submobjects.map((l) => new Create(l)), { lagRatio: 0.4 }), { runTime: 0.9 });

    const caption = new Text("Three steps. Zero code.", { fontSize: 0.42, color: "#9AA3AF", point: [0, -2.4, 0] });
    await this.play(new FadeIn(caption, { shift: [0, 0.3, 0] }), { runTime: 0.6 });
    await this.wait(1.0);

    // Slide transition to the closing screen.
    const pageA = new VGroup(row, connectors, caption, title);
    const pageB = new VGroup(
      new Text("Automate it with Relay", { fontSize: 0.72, color: "#F5F6F8", point: [0, 0.3, 0] }),
      new Text("relay.app", { fontSize: 0.45, color: "#58C4DD", point: [0, -0.7, 0] }),
    );
    await this.play(slide(pageA, pageB, { direction: [0, 5, 0], runTime: 1.0, fps: this.fps }));
    await this.wait(1.2);
  }
}

await demoRender(Relay, import.meta.url, { background: "#12161B" });

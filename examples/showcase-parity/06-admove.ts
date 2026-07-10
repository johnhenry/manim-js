// Showcase parity: AdMove — branded product ads generated per campaign.
// Proves: registerStylePreset() brand themes driving the template system,
// titleCard → product shot (drop shadow effect) → statCounter price →
// outroCard composed with Timeline-style flow, 1:1 social aspect, and the
// SAME ad rendered under TWO brand presets.

import {
  Scene, Text, Circle, RoundedRectangle, VGroup, FadeIn, FadeOut,
  registerStylePreset, resolveTheme, titleCard, statCounter, outroCard,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

registerStylePreset("brand-volt", {
  name: "brand-volt",
  background: "#101418",
  palette: ["#B5FF2B", "#F5F6F8", "#5CD0B3"],
});
registerStylePreset("brand-coral", {
  name: "brand-coral",
  background: "#FFF6F2",
  palette: ["#FF5A5F", "#2A2D34", "#FFB400"],
});

class AdMove extends Scene {
  async construct() {
    const brand = String(this.params.brand ?? "brand-volt");
    const theme = resolveTheme(brand);

    const card = titleCard("The Volt Bottle", { subtitle: "Cold for 24 hours", theme });
    card.group.scale(0.62).shift([0, 1.8, 0]);
    await this.play(card.animateIn());
    await this.wait(0.4);

    // Product shot: a stylized bottle with a themed drop shadow.
    const bottle = new VGroup(
      new RoundedRectangle({ width: 1.1, height: 2.4, cornerRadius: 0.35, color: theme.accent, fillOpacity: 1, strokeWidth: 0 }),
      new RoundedRectangle({ width: 0.5, height: 0.45, cornerRadius: 0.12, color: theme.foreground, fillOpacity: 1, strokeWidth: 0, point: [0, 1.4, 0] }),
      new Circle({ radius: 0.28, color: theme.preset.background, fillOpacity: 1, strokeWidth: 0, point: [0, 0.3, 0] }),
    );
    bottle.moveTo([0, -1.1, 0]);
    bottle.dropShadow(24, "#000000", 0.12, -0.12);
    await this.play(new FadeIn(bottle, { shift: [0, 0.5, 0], scale: 0.85 }), { runTime: 0.9 });
    await this.wait(0.5);

    // Price counts up.
    const price = statCounter("launch price", 29, { theme, point: [0, -1.1, 0], decimals: 0 });
    await this.play(card.animateOut(), bottle.animate.scale(0.72).moveTo([0, 1.3, 0]), { runTime: 0.8 });
    this.add(price.group);
    await this.play(price.animateIn(), { runTime: 0.5 });
    await this.play(price.playThrough(1.2));
    const currency = new Text("$", { fontSize: 0.7, color: theme.accent });
    currency.nextTo(price.number, [-1, 0, 0], 0.15);
    await this.play(new FadeIn(currency), { runTime: 0.3 });
    await this.wait(0.6);

    // Outro.
    await this.play(price.animateOut(), new FadeOut(currency), new FadeOut(bottle), { runTime: 0.6 });
    const outro = outroCard("voltbottle.com", { handle: "@voltbottle", theme });
    await this.play(outro.animateIn());
    await this.wait(1.0);
    await this.play(outro.animateOut(), { runTime: 0.6 });
  }
}

// Same ad, two brand systems — the AdMove pitch.
await demoRender(AdMove, import.meta.url, {
  aspectRatio: "1:1", style: "brand-volt", background: "#101418",
  params: { brand: "brand-volt" }, suffix: "-volt",
});
await demoRender(AdMove, import.meta.url, {
  aspectRatio: "1:1", style: "brand-coral", background: "#FFF6F2",
  params: { brand: "brand-coral" }, suffix: "-coral",
});

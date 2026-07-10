// Showcase parity: Hello Météo — daily weather bulletins from data.
// Proves: schema params (city selects data + icon), authored id-layered SVG
// icons animated per-part via SVGMobject.byId() (P1), and the same scene
// rendered twice for two cities.

import {
  Scene, SVGMobject, Text, VGroup, FadeIn, FadeOut, Write, LaggedStart,
  defineSchema, Repeat,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

// Authored, id-layered icons (each part addressable via byId).
const SUNNY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g id="rays" stroke="#FFD700" stroke-width="5">
    <line x1="50" y1="6"  x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="94"/>
    <line x1="6"  y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="94" y2="50"/>
    <line x1="19" y1="19" x2="29" y2="29"/><line x1="71" y1="71" x2="81" y2="81"/>
    <line x1="19" y1="81" x2="29" y2="71"/><line x1="71" y1="29" x2="81" y2="19"/>
  </g>
  <circle id="sun" cx="50" cy="50" r="22" fill="#FFD700"/>
</svg>`;

const RAINY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g id="cloud" fill="#B9C2CC">
    <circle cx="38" cy="42" r="16"/><circle cx="58" cy="38" r="19"/>
    <circle cx="72" cy="46" r="13"/><rect x="24" y="42" width="60" height="16" rx="8"/>
  </g>
  <g id="drops" fill="#58C4DD">
    <path d="M36 66 q4 10 0 14 q-4 -4 0 -14 Z"/>
    <path d="M54 70 q4 10 0 14 q-4 -4 0 -14 Z"/>
    <path d="M70 64 q4 10 0 14 q-4 -4 0 -14 Z"/>
  </g>
</svg>`;

const CITIES: Record<string, { name: string; temp: number; kind: "sunny" | "rainy"; blurb: string }> = {
  marseille: { name: "Marseille", temp: 29, kind: "sunny", blurb: "Plein soleil toute la journée" },
  brest: { name: "Brest", temp: 16, kind: "rainy", blurb: "Averses en matinée" },
};

class HelloMeteo extends Scene {
  static schema = defineSchema({
    city: { type: "enum", values: ["marseille", "brest"], default: "marseille" },
  });

  async construct() {
    const city = CITIES[this.params.city ?? "marseille"];
    const header = new Text(`Météo — ${city.name}`, { fontSize: 0.68, color: "#F5F6F8", point: [0, 3.1, 0] });
    await this.play(new Write(header), { runTime: 0.8 });

    const icon = new SVGMobject(city.kind === "sunny" ? SUNNY_SVG : RAINY_SVG, { height: 3.2 });
    icon.moveTo([-2.6, 0.2, 0]);
    await this.play(new FadeIn(icon, { scale: 0.85 }), { runTime: 0.7 });

    // Per-part animation through the id layer.
    if (city.kind === "sunny") {
      await this.play(
        new Repeat(icon.byId("rays").animate.rotate(Math.PI / 4).build(), { count: 1 }),
        { runTime: 1.6 },
      );
    } else {
      const drops = icon.byId("drops");
      await this.play(
        new LaggedStart(drops.submobjects.map((d) => new FadeIn(d, { shift: [0, -0.35, 0] })), { lagRatio: 0.3 }),
        { runTime: 1.2 },
      );
    }

    const temp = new Text(`${city.temp}°`, { fontSize: 1.5, color: "#FFD700", point: [2.4, 0.6, 0] });
    const blurb = new Text(city.blurb, { fontSize: 0.4, color: "#9AA3AF", point: [2.4, -0.9, 0] });
    await this.play(new FadeIn(temp, { shift: [0, 0.3, 0] }), new FadeIn(blurb), { runTime: 0.8 });
    await this.wait(1.4);
    await this.play(new FadeOut(header), new FadeOut(icon), new FadeOut(temp), new FadeOut(blurb), { runTime: 0.7 });
  }
}

await demoRender(HelloMeteo, import.meta.url, { background: "#10151C", params: { city: "marseille" }, suffix: "-marseille" });
await demoRender(HelloMeteo, import.meta.url, { background: "#10151C", params: { city: "brest" }, suffix: "-brest" });

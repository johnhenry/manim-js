// Showcase parity: Submagic — auto-captions with word pops and emoji beats.
// Proves: WordCaptionTrack (per-word color pop + dimmed future words) on a
// 9:16 frame, emoji-style reactions timed to caption beats (vector-drawn —
// the SVG-emoji fallback; color-emoji fonts vary by host), and punch-zoom
// camera hits on emphasis words.

import {
  MovingCameraScene, VGroup, Circle, Polygon, Text, FadeIn, FadeOut, GrowFromCenter,
  createTikTokStyleCaptions, WordCaptionTrack,
} from "../../src/node.ts";
import type { Caption } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const WORDS: Array<[string, number, number]> = [
  ["This", 300, 550], [" trick", 550, 900], [" doubled", 900, 1400], [" my", 1400, 1650], [" reach", 1650, 2200],
  ["Post", 2700, 3000], [" at", 3000, 3200], [" golden", 3200, 3700], [" hour", 3700, 4200],
  ["Every", 4700, 5000], [" single", 5000, 5400], [" day", 5400, 6000],
];
const captions: Caption[] = WORDS.map(([text, startMs, endMs]) => ({
  text, startMs, endMs, timestampMs: startMs, confidence: null,
}));
const { pages } = createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 400 });

// Vector "emoji": a fire glyph and a heart (no color-emoji font needed).
function fireEmoji(): VGroup {
  const flame = new Polygon(
    [[0, 0.55, 0], [0.3, 0.1, 0], [0.18, -0.35, 0], [0, -0.5, 0], [-0.18, -0.35, 0], [-0.3, 0.1, 0]],
    { color: "#FF862F", fillOpacity: 1, strokeWidth: 0 },
  );
  const core = new Circle({ radius: 0.16, color: "#FFE066", fillOpacity: 1, strokeWidth: 0, point: [0, -0.22, 0] });
  return new VGroup(flame, core);
}
function heartEmoji(): VGroup {
  const left = new Circle({ radius: 0.18, color: "#FC6255", fillOpacity: 1, strokeWidth: 0, point: [-0.15, 0.12, 0] });
  const right = new Circle({ radius: 0.18, color: "#FC6255", fillOpacity: 1, strokeWidth: 0, point: [0.15, 0.12, 0] });
  const tip = new Polygon([[-0.32, 0.08, 0], [0.32, 0.08, 0], [0, -0.42, 0]], { color: "#FC6255", fillOpacity: 1, strokeWidth: 0 });
  return new VGroup(tip, left, right);
}

class Submagic extends MovingCameraScene {
  async construct() {
    const hook = new Text("CREATOR TIP #7", { fontSize: 0.3, color: "#39FF14", point: [0, 3.4, 0] });
    await this.play(new FadeIn(hook), { runTime: 0.3 });

    const track = new WordCaptionTrack(pages, {
      fontSize: 0.42, maxWidth: 3.9, point: [0, 0, 0],
      color: "#FFFFFF",
      highlight: { color: "#39FF14", scale: 1.12, popMs: 120, futureOpacity: 0.35 },
    });
    this.add(track);

    const frame = this.camera!.frame!;
    // Beat 1: "doubled my reach" — punch-zoom + fire.
    await this.wait(0.9);
    const fire = fireEmoji();
    fire.scale(1.7).moveTo([1.5, -1.3, 0]);
    await this.play(
      new GrowFromCenter(fire),
      frame.animate.scale(0.88),
      { runTime: 0.25 },
    );
    await this.play(frame.animate.scale(1 / 0.88), { runTime: 0.3 });
    await this.wait(1.2);

    // Beat 2: "golden hour" — heart + a softer punch.
    const heart = heartEmoji();
    heart.scale(1.7).moveTo([-1.5, -1.4, 0]);
    await this.play(new GrowFromCenter(heart), frame.animate.scale(0.92), { runTime: 0.25 });
    await this.play(frame.animate.scale(1 / 0.92), { runTime: 0.3 });
    await this.play(new FadeOut(fire), { runTime: 0.4 });
    await this.wait(1.2);

    // Beat 3: close.
    await this.wait(1.2);
    await this.play(new FadeOut(heart), new FadeOut(hook), new FadeOut(track), { runTime: 0.6 });
  }
}

await demoRender(Submagic, import.meta.url, { aspectRatio: "9:16", background: "#101014" });

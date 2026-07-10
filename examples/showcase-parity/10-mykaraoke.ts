// Showcase parity: MyKaraoke Video — karaoke lyric videos.
// Proves: WordCaptionTrack karaoke sweep (active-word color pop), a bouncing
// follow-the-lyrics dot driven by an updater over the live token layout, and
// a runtime-synthesized melody (ffmpeg sine notes) muxed under the video.

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import {
  Scene, Circle, Text, FadeIn, FadeOut, Write,
  createTikTokStyleCaptions, WordCaptionTrack,
} from "../../src/node.ts";
import type { Caption } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const GEN_DIR = new URL("./out/_gen/", import.meta.url).pathname;
mkdirSync(GEN_DIR, { recursive: true });
const MELODY_WAV = `${GEN_DIR}melody.wav`;
// A simple synthesized melody: C4 E4 G4 C5 arpeggio, two bars.
const NOTES = [262, 330, 392, 523, 392, 330, 262, 330, 392, 523, 659, 523];
const CONCAT = NOTES.map((f, i) => `[${i}:a]`).join("");
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  ...NOTES.flatMap((f) => ["-f", "lavfi", "-i", `sine=frequency=${f}:duration=0.55`]),
  "-filter_complex", `${CONCAT}concat=n=${NOTES.length}:v=0:a=1,volume=0.5[out]`,
  "-map", "[out]", MELODY_WAV,
]);

// One lyric line per "bar", word-timed to the melody (550ms per note).
const LYRIC: Array<[string, number, number]> = [
  ["Take", 200, 750], [" me", 750, 1300], [" down", 1300, 1850], [" slow", 1850, 2500],
  ["Where", 3400, 3950], [" the", 3950, 4300], [" rivers", 4300, 5050], [" go", 5050, 5900],
];
const captions: Caption[] = LYRIC.map(([text, startMs, endMs]) => ({
  text, startMs, endMs, timestampMs: startMs, confidence: null,
}));
const { pages } = createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 600 });

class MyKaraoke extends Scene {
  async construct() {
    this.addSound(MELODY_WAV, { gain: 0.8 });

    const title = new Text("♪ Riverside — sing along ♪", { fontSize: 0.5, color: "#C9A0DC", point: [0, 2.9, 0] });
    await this.play(new Write(title), { runTime: 0.7 });

    const track = new WordCaptionTrack(pages, {
      fontSize: 0.62, point: [0, -0.4, 0],
      color: "#F5F6F8",
      highlight: { color: "#FFD700", scale: 1.18, popMs: 140, futureOpacity: 0.45 },
    });
    this.add(track);

    // The bouncing karaoke dot: hops onto each word as it becomes active.
    const dot = new Circle({ radius: 0.11, color: "#FFD700", fillOpacity: 1, strokeWidth: 0, point: [0, 0.6, 0] });
    let clock = 0;
    dot.addUpdater((_m: any, dt: number) => {
      clock += dt * 1000;
      const idx = LYRIC.findIndex(([, fromMs, toMs]) => clock >= fromMs && clock < toMs);
      if (idx === -1) return;
      // Map the absolute lyric index onto the current page's token list.
      const pageStart = clock < 3000 ? 0 : 4;
      const tok = track.tokenTexts[idx - pageStart];
      if (!tok) return;
      const [x, y] = tok.getCenter();
      const [, fromMs, toMs] = LYRIC[idx];
      const p = (clock - fromMs) / Math.max(1, toMs - fromMs);
      const hop = 0.35 * Math.sin(Math.PI * Math.min(1, p));
      dot.moveTo([x, y + tok.getHeight() / 2 + 0.22 + hop, 0]);
    });
    this.add(dot);

    await this.wait(6.2);
    await this.play(new FadeOut(track), new FadeOut(dot), new FadeOut(title), { runTime: 0.7 });
  }
}

await demoRender(MyKaraoke, import.meta.url, { background: "#141020" });

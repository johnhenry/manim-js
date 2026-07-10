// Showcase parity: Revid.ai — automated 9:16 social clips from a script.
// Proves: the socialShort 9:16 scaffold, SRT-driven CaptionTrack karaoke,
// a Ken-Burns b-roll pan/zoom, and a runtime-synthesized ambient tone bed
// muxed under the clip (scene.addSound).

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import {
  Scene, VGroup, Circle, Polygon, Rectangle, Text, FadeIn, FadeOut,
  parseSrt, CaptionTrack,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const GEN_DIR = new URL("./out/_gen/", import.meta.url).pathname;
mkdirSync(GEN_DIR, { recursive: true });
const TONE_WAV = `${GEN_DIR}tone-bed.wav`;
// Soft ambient bed: two detuned sines, low volume.
execFileSync("ffmpeg", [
  "-y", "-loglevel", "error",
  "-f", "lavfi", "-i", "sine=frequency=196:duration=9",
  "-f", "lavfi", "-i", "sine=frequency=294:duration=9",
  "-filter_complex", "amix=inputs=2,volume=0.25",
  TONE_WAV,
]);

const SRT = `1
00:00:00,400 --> 00:00:02,600
Three places to see
before summer ends

2
00:00:02,900 --> 00:00:05,200
Golden hour at the dunes
hits different

3
00:00:05,500 --> 00:00:08,200
Save this for your
next weekend trip`;

class Revid extends Scene {
  async construct() {
    this.addSound(TONE_WAV, { gain: 0.6 });

    // B-roll: a stylized dune landscape, Ken-Burns push-in + drift.
    const sky = new Rectangle({ width: 7, height: 7, color: "#FF9E5E", fillOpacity: 1, strokeWidth: 0, point: [0, 1.4, 0] });
    const sun = new Circle({ radius: 0.9, color: "#FFE066", fillOpacity: 1, strokeWidth: 0, point: [1.2, 1.9, 0] });
    const duneBack = new Polygon([[-3.5, 0.4, 0], [-1, 1.4, 0], [1.5, 0.2, 0], [3.5, 1.0, 0], [3.5, -1.6, 0], [-3.5, -1.6, 0]], { color: "#C96F3B", fillOpacity: 1, strokeWidth: 0 });
    const duneFront = new Polygon([[-3.5, -0.6, 0], [-0.5, 0.6, 0], [3.5, -0.9, 0], [3.5, -2.4, 0], [-3.5, -2.4, 0]], { color: "#8C4A2F", fillOpacity: 1, strokeWidth: 0 });
    const broll = new VGroup(sky, sun, duneBack, duneFront);
    broll.moveTo([0, 0.9, 0]);
    this.add(broll);

    const header = new Text("WEEKEND ESCAPES", { fontSize: 0.26, color: "#FFE066", point: [0, 3.5, 0] });
    await this.play(new FadeIn(header, { shift: [0, -0.2, 0] }), { runTime: 0.5 });

    // Captions from the SRT, karaoke reveal, pinned to the caption slot.
    const captions = new CaptionTrack(parseSrt(SRT), {
      fontSize: 0.3, karaoke: true, point: [0, -2.7, 0], color: "#FFFFFF",
    });
    this.add(captions);

    // Ken-Burns: slow push + lateral drift while the captions run.
    await this.play(
      broll.animate.scale(1.28).shift([-0.45, 0.15, 0]),
      { runTime: 7.0 },
    );
    await this.wait(0.6);
    await this.play(new FadeOut(broll), new FadeOut(header), new FadeOut(captions), { runTime: 0.8 });
  }
}

await demoRender(Revid, import.meta.url, { aspectRatio: "9:16", background: "#1A1210" });

// External-video ingestion: place a VideoMobject (a clip decoded to frames by
// ffmpeg) into a scene, play it while other mobjects animate, and mux the clip's
// audio into the output. Run: node examples/video.ts -> examples/out/video.mp4
//
// This example synthesizes its own 2s test clip (with a tone) via ffmpeg so it
// needs no asset; swap `CLIP` for a real file path to ingest your own video.

import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import {
  render, loadVideo, Scene, Circle, Text, Create, Write, FadeIn,
  BLUE, YELLOW, UP, DOWN,
} from "../src/node.ts";

mkdirSync("examples/out", { recursive: true });
const CLIP = "examples/out/_sample-clip.mp4";
if (!existsSync(CLIP)) {
  // A color test pattern + a 330 Hz tone, 2 seconds.
  spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc=duration=2:size=320x180:rate=30",
    "-f", "lavfi", "-i", "sine=frequency=330:duration=2",
    "-pix_fmt", "yuv420p", "-shortest", "-y", CLIP,
  ]);
}

class VideoScene extends Scene {
  async construct() {
    // Decode the clip to frames at the scene fps and mux its audio into the render.
    const clip = await loadVideo(CLIP, { width: 7, fps: 30, scene: this, audio: true });
    clip.moveTo(UP.map((x) => x * 0.6));
    this.add(clip); // starts playing as scene time advances

    const caption = new Text("VideoMobject", { fontSize: 0.7, color: YELLOW });
    caption.moveTo([0, -2.7, 0]);
    await this.play(new Write(caption), { _playConfig: true, runTime: 0.6 });

    const dot = new Circle({ radius: 0.3, color: BLUE, fillColor: BLUE, fillOpacity: 1 });
    dot.moveTo(DOWN.map((x) => x * 3.4));
    await this.play(new FadeIn(dot), { _playConfig: true, runTime: 0.5 });
    await this.wait(1.0); // the clip keeps playing through the wait
  }
}

const res = await render(VideoScene, {
  output: "examples/out/video.mp4",
  quality: "medium",
  fps: 30,
  background: "#0d1117",
});
console.log(`Wrote ${res.output} (${res.frames} frames, ${res.sounds} audio track(s))`);

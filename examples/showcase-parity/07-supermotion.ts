// Showcase parity: Supermotion — screen-recording promos with auto-zoom.
// Proves: two-stage pipeline (stage 1 renders a fake app-UI "screen
// recording" mp4; stage 2 ingests it as a VideoMobject), video playback
// inside a styled browser frame, and defineCameraStop/goToCameraStop
// auto-zoom onto the click moment (the Supermotion signature).

import { mkdirSync } from "node:fs";
import {
  render, loadVideo, MovingCameraScene, Scene, VGroup,
  RoundedRectangle, Circle, Rectangle, Text, FadeIn, FadeOut,
} from "../../src/node.ts";
import { demoRender, DEMO_QUALITY } from "./_run.ts";

const GEN_DIR = new URL("./out/_gen/", import.meta.url).pathname;
mkdirSync(GEN_DIR, { recursive: true });
const SCREEN_MP4 = `${GEN_DIR}screen.mp4`;

// --- Stage 1: synthesize the "screen recording" -----------------------------
class FakeAppUI extends Scene {
  async construct() {
    const panel = new RoundedRectangle({ width: 10, height: 6, cornerRadius: 0.3, color: "#1C2128", fillOpacity: 1, strokeWidth: 0 });
    const sidebar = new Rectangle({ width: 2.4, height: 6, color: "#161A20", fillOpacity: 1, strokeWidth: 0, point: [-3.8, 0, 0] });
    const heading = new Text("Projects", { fontSize: 0.45, color: "#F5F6F8", point: [-3.8, 2.4, 0] });
    const rows = new VGroup();
    for (let i = 0; i < 3; i++) {
      rows.add(new RoundedRectangle({
        width: 6.4, height: 1.1, cornerRadius: 0.18,
        color: "#242B33", fillOpacity: 1, strokeWidth: 0, point: [1.2, 1.6 - i * 1.5, 0],
      }));
    }
    const button = new RoundedRectangle({ width: 2.2, height: 0.8, cornerRadius: 0.4, color: "#58C4DD", fillOpacity: 1, strokeWidth: 0, point: [3.4, -2.2, 0] });
    const buttonLabel = new Text("Deploy", { fontSize: 0.34, color: "#10161C", point: [3.4, -2.2, 0] });
    this.add(panel, sidebar, heading, rows, button, buttonLabel);

    // Cursor glides to the button and clicks (ripple).
    const cursor = new Circle({ radius: 0.12, color: "#FFFFFF", fillOpacity: 1, strokeWidth: 0, point: [-1.5, 1.6, 0] });
    this.add(cursor);
    await this.wait(0.4);
    await this.play(cursor.animate.moveTo([3.4, -2.2, 0]), { runTime: 1.2 });
    const ripple = new Circle({ radius: 0.15, color: "#FFFFFF", fillOpacity: 0, strokeWidth: 3, point: [3.4, -2.2, 0] });
    await this.play(ripple.animate.scale(3.2), button.animate.setColor("#83C167"), { runTime: 0.5 });
    await this.play(new FadeOut(ripple), { runTime: 0.3 });
    await this.wait(0.6);
  }
}

await render(FakeAppUI, { output: SCREEN_MP4, quality: DEMO_QUALITY, fps: 20, verbose: false, background: "#0B0E12" });
console.log("✓ stage 1: fake screen recording generated");

// --- Stage 2: the promo — video in a browser frame + auto-zoom --------------
const screenClip = await loadVideo(SCREEN_MP4, { fps: 20, width: 10.2 });

class Supermotion extends MovingCameraScene {
  async construct() {
    const chrome = new RoundedRectangle({ width: 10.8, height: 6.9, cornerRadius: 0.25, color: "#2A2F36", fillOpacity: 1, strokeWidth: 0, point: [0, -0.2, 0] });
    const lights = new VGroup(
      ...["#FF5F56", "#FFBD2E", "#27C93F"].map((c, i) =>
        new Circle({ radius: 0.08, color: c, fillOpacity: 1, strokeWidth: 0, point: [-4.9 + i * 0.3, 2.9, 0] })),
    );
    const video = screenClip;
    video.moveTo([0, -0.35, 0]);
    const caption = new Text("Ship it in one click", { fontSize: 0.7, color: "#F5F6F8", point: [0, 3.5, 0] });

    this.defineCameraStop("wide", { center: [0, 0, 0], zoom: 1 });
    // The click happens at the button, bottom-right of the video.
    this.defineCameraStop("click", { center: [3.0, -2.0, 0], zoom: 2.1 });

    await this.play(new FadeIn(chrome), new FadeIn(lights), new FadeIn(video), new FadeIn(caption), { runTime: 0.7 });
    await this.wait(0.5); // cursor gliding
    await this.goToCameraStop("click", { runTime: 0.9 });
    await this.wait(1.4); // the click, up close
    await this.goToCameraStop("wide", { runTime: 0.9 });
    await this.wait(0.8);
    await this.play(new FadeOut(chrome), new FadeOut(lights), new FadeOut(video), new FadeOut(caption), { runTime: 0.6 });
  }
}

await demoRender(Supermotion, import.meta.url, { background: "#0B0E12" });

// The plugin system, end to end: a native plugin (use()) that registers a
// custom Mobject/Animation/rate function/color, and a portable JSON manifest
// (loadManifestFromFile()) that registers a parametric Surface, an SVG shape,
// colors and a rate function — the same manifest also loads into Python manim
// (see docs/plugins.md). Both plugins register a rate function named "thump";
// this demonstrates (and logs) the last-registration-wins collision behavior.
// Run: node examples/plugins-demo.ts -> examples/out/plugins-demo.mp4
import {
  render, use, loadManifestFromFile, registry,
  ThreeDScene, ThreeDCamera, FadeIn, Create, DEGREES,
} from "../src/node.ts";
import heartPlugin from "./plugins/heart-plugin.ts";

use(heartPlugin);
console.log("after native plugin: thump(0.25) =", registry.get("rateFunction", "thump")(0.25));

const manifestSummary = await loadManifestFromFile("./examples/plugins/cyberpunk.manifest.json");
console.log("manifest loaded:", manifestSummary);
console.log("after manifest:    thump(0.25) =", registry.get("rateFunction", "thump")(0.25), "(manifest's definition wins - last registration)");

const Heart = registry.get("mobject", "Heart");
const Heartbeat = registry.get("animation", "Heartbeat");
const MobiusStrip = registry.get("mobject", "MobiusStrip");
const NeonStar = registry.get("mobject", "NeonStar");
const neonCyan = registry.get("color", "NEON_CYAN");
const neonPink = registry.get("color", "NEON_PINK");
const overshoot = registry.get("rateFunction", "overshoot");

class PluginsDemo extends ThreeDScene {
  async construct() {
    this.setCameraOrientation({ phi: 10 * DEGREES, theta: -90 * DEGREES });

    const heart = new Heart({ height: 2.2 }).moveTo([-2.5, 0.5, 0]);
    const star = new NeonStar({ height: 1.8 }).moveTo([2.5, 0.5, 0]);
    await this.play(new Create(heart), new Create(star), { _playConfig: true, runTime: 1 });
    await this.play(new Heartbeat(heart, { runTime: 1.6, rateFunc: (t: number) => t }));

    // Orbit into 3D to reveal the manifest's parametric Mobius strip, using
    // its own "overshoot" rate function for the camera ease.
    const mobius = new MobiusStrip().moveTo([0, -1.5, 0]).scale(1.4);
    await this.play(new FadeIn(mobius), { _playConfig: true, runTime: 0.8 });
    await this.moveCamera({ phi: 65 * DEGREES, theta: -45 * DEGREES }, { runTime: 2.5, rateFunc: overshoot });
    await this.wait(0.4);
  }
}

await render(PluginsDemo, {
  output: "examples/out/plugins-demo.mp4",
  quality: "medium",
  background: "#0d0d18",
  camera: new ThreeDCamera({ phi: 10 * DEGREES, theta: -90 * DEGREES }),
});
console.log(`colors available: ${neonCyan}, ${neonPink}`);

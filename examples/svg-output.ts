// Vector (SVG) output: render the same Scene to resolution-independent SVG
// instead of raster video. Deterministic, no GPU, no browser.
// Run: node examples/svg-output.ts
//   -> examples/out/svg-output.svg          (single final frame)
//   -> examples/out/svg-output-seq_svg/     (numbered per-frame sequence)

import {
  render, Scene, Circle, Square, Polygon, Create, Transform,
  BLUE, GREEN, YELLOW,
} from "../src/node.ts";

class VectorScene extends Scene {
  async construct() {
    const c = new Circle({ radius: 1.6, color: BLUE, fillColor: BLUE, fillOpacity: 0.5 });
    c.moveTo([-3, 0, 0]);
    await this.play(new Create(c));

    const tri = new Polygon([[0, 1.6, 0], [-1.4, -1.2, 0], [1.4, -1.2, 0]], {
      color: YELLOW, fillColor: YELLOW, fillOpacity: 0.4,
    });
    await this.play(new Create(tri));

    const sq = new Square({ sideLength: 2.6, color: GREEN, fillColor: GREEN, fillOpacity: 0.5 });
    sq.moveTo([3, 0, 0]);
    await this.play(new Transform(c, sq));
    await this.wait(0.3);
    // End on the full composition so the single-frame SVG is a complete picture.
  }
}

// Single final frame -> one .svg
await render(VectorScene, {
  output: "examples/out/svg-output.svg",
  format: "svg",
  saveLastFrame: true,
  quality: "medium",
  background: "#0d1117",
});

// Full animation -> a numbered .svg sequence (one file per frame).
await render(VectorScene, {
  output: "examples/out/svg-output-seq.svg",
  format: "svg",
  quality: "low",
  background: "#0d1117",
});

console.log("Wrote examples/out/svg-output.svg and examples/out/svg-output-seq_svg/");

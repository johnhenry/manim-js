// Diagram-as-code with an animated board transition + auto shared-element
// matching. Build a board from a tiny DSL, then morph it to a re-laid-out board:
// TransformMatchingAuto pairs nodes/edges by matchId and tweens the deltas.
// Run: node examples/diagram.ts  ->  examples/out/diagram.mp4

import { render, Scene, buildBoard, parseDiagram, TransformMatchingAuto } from "../src/node.ts";

const DSL = `
A[Start]
A --> B
A --> C
B --> D
C --> D
`;

class Diagram extends Scene {
  async construct() {
    const graph = parseDiagram(DSL);
    const layered = buildBoard(graph, { algorithm: "layered", layerGap: 3.2 });
    this.add(layered);
    await this.play(new (await import("../src/index.ts")).Create(layered), { _playConfig: true, runTime: 0.8 });
    await this.wait(0.4);

    // Re-lay-out the same graph as a ring; nodes glide to their new spots.
    const circular = buildBoard(graph, { algorithm: "circular", nodeGap: 2.4 });
    await this.play(new TransformMatchingAuto(layered, circular), { _playConfig: true, runTime: 1.2 });
    await this.wait(0.4);
  }
}

await render(Diagram, {
  output: "examples/out/diagram.mp4",
  style: "clean-corporate",
  quality: "low",
});

console.log("Wrote examples/out/diagram.mp4");

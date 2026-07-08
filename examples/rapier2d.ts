// Real 2D rigid-body physics via the Rapier2D backend: a pile of squares that
// actually stack and collide with each other and the walls — genuine contacts,
// not just the single floor plane SimpleEngine offers.
// Requires the optional dep: npm i @dimforge/rapier2d-compat
// Run: node examples/rapier2d.ts -> examples/out/rapier2d.mp4

import { render, Scene, Square, Line, BLUE, GREEN, YELLOW, RED } from "../src/node.ts";
import { rapier2d } from "../src/physics/rapier2d.ts";

const COLORS = [BLUE, GREEN, YELLOW, RED];

class Stack extends Scene {
  async construct() {
    const floorY = -3;
    // Visual floor + two containing walls (drawn; their colliders are added below).
    this.add(new Line([-4, floorY, 0], [4, floorY, 0], { color: "#94a3b8" }));
    this.add(new Line([-4, floorY, 0], [-4, 3, 0], { color: "#94a3b8" }));
    this.add(new Line([4, floorY, 0], [4, 3, 0], { color: "#94a3b8" }));

    const engine = await rapier2d(this, {
      gravity: [0, -9.8, 0], floor: floorY, restitution: 0.1, friction: 0.9,
    });

    // Static wall colliders: a side-6 square has half-extent 3, so centering it
    // at x = ±7 puts its inner face exactly on the drawn wall at x = ±4.
    for (const sign of [-1, 1]) {
      const wall = new Square({ sideLength: 6 }).moveTo([sign * 7, 0, 0]);
      engine.addBody(wall, { static: true });
    }

    // Drop eight squares down the middle; they collide and settle into a pile.
    for (let i = 0; i < 8; i++) {
      const box = new Square({ sideLength: 0.9, color: COLORS[i % COLORS.length], fillColor: COLORS[i % COLORS.length], fillOpacity: 0.6 })
        .moveTo([(i % 2 ? 0.4 : -0.4), 3 + i * 0.8, 0]);
      this.add(box);
      engine.addBody(box, { velocity: [i % 2 ? -0.5 : 0.5, 0, 0], angularVelocity: (i % 2 ? 1 : -1) });
    }

    await this.wait(5);
  }
}

await render(Stack, {
  output: "examples/out/rapier2d.mp4",
  quality: "low",
  background: "#0d1117",
});

console.log("Wrote examples/out/rapier2d.mp4");

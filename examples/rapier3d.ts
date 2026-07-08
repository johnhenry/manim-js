// Real 3D rigid-body physics via the Rapier3D backend: a handful of cubes
// dropped with initial spin so they tumble in full 3D and settle into a pile on
// the floor — body↔body collision and friction the built-in SimpleEngine can't
// do. Requires the optional dep: npm i @dimforge/rapier3d-compat
// Run: node examples/rapier3d.ts -> examples/out/rapier3d.mp4

import {
  render, ThreeDScene, ThreeDCamera, Cube, Line, DEGREES, BLUE, GREEN, YELLOW, RED,
} from "../src/node.ts";
import { rapier3d } from "../src/physics/rapier3d.ts";

const COLORS = [BLUE, GREEN, YELLOW, RED];

class Tumble extends ThreeDScene {
  async construct() {
    this.setCameraOrientation({ phi: 68 * DEGREES, theta: -55 * DEGREES, zoom: 0.6, frameCenter: [0, -0.3, 0] });

    const floorY = -2;
    // A wireframe ground grid at y = floorY. Thin lines (not a solid plate) so
    // the CPU 3D renderer never occludes the cubes resting on the floor — a big
    // opaque floor face would win the painter sort and hide them.
    const G = 3;
    for (let i = -G; i <= G; i++) {
      this.add(new Line([i, floorY, -G], [i, floorY, G], { color: "#3a4759" }));
      this.add(new Line([-G, floorY, i], [G, floorY, i], { color: "#3a4759" }));
    }

    const engine = await rapier3d(this, {
      gravity: [0, -9.8, 0], floor: floorY, restitution: 0.2, friction: 0.8,
    });

    // Drop five cubes in a loose central column from staggered heights, each
    // with its own spin so they tumble on the way down and jostle into a pile.
    // No horizontal launch velocity, so they stay over the plate.
    for (let i = 0; i < 5; i++) {
      const cube = new Cube({
        sideLength: 0.8,
        point: [((i % 2) - 0.5) * 0.5, 0.5 + i * 0.9, (((i + 1) % 2) - 0.5) * 0.5],
        color: COLORS[i % COLORS.length], fillOpacity: 0.85,
      });
      this.add(cube);
      engine.addBody(cube, {
        angularVelocity: [0.6 + i * 0.15, 0.8 - i * 0.1, 0.2 * i],
      });
    }

    // Let them fall, tumble, collide, and settle onto the floor.
    await this.wait(4);
  }
}

await render(Tumble, {
  output: "examples/out/rapier3d.mp4",
  quality: "low",
  background: "#0d1117",
  camera: new ThreeDCamera({ phi: 68 * DEGREES, theta: -55 * DEGREES, zoom: 0.6, frameCenter: [0, 0.3, 0] }),
});

console.log("Wrote examples/out/rapier3d.mp4");

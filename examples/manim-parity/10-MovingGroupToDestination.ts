// Port of Manim CE gallery: MovingGroupToDestination
// (ref/MovingGroupToDestination.py).

import { Scene, Dot, VGroup, LEFT, ORIGIN, RIGHT, RED, YELLOW } from "../../src/node.ts";
import * as V from "../../src/core/math/vector.ts";
import { demoRender } from "./_run.ts";

class MovingGroupToDestination extends Scene {
  async construct() {
    const group = new VGroup(
      new Dot({ point: LEFT }),
      new Dot({ point: ORIGIN }),
      new Dot({ point: RIGHT, color: RED }),
      new Dot({ point: V.scale(RIGHT, 2) }),
    ).scale(1.4);
    const dest = new Dot({ point: [4, 3, 0], color: YELLOW });
    this.add(group, dest);
    await this.play(group.animate.shift(V.sub(dest.getCenter(), group.get(2).getCenter())));
    await this.wait(0.5);
  }
}

await demoRender(MovingGroupToDestination, import.meta.url);

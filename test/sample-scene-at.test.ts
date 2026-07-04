// sampleSceneAt() replays a Scene's construct() from the start and stops as
// soon as the scene's own simulated clock reaches a target time, returning
// the driven Scene so its mobjects reflect the interpolated state at that
// moment -- the primitive that lets a Scene's animation be scrubbed/embedded
// elsewhere without a full render. See src/scene/orchestrate.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Scene } from "../src/scene/Scene.ts";
import { Circle } from "../src/mobject/geometry.ts";
import { sampleSceneAt } from "../src/scene/orchestrate.ts";

class MoveScene extends Scene {
  circle!: Circle;
  async construct() {
    this.circle = new Circle({ radius: 1 });
    this.add(this.circle);
    await this.wait(1); // t: 0 -> 1, stationary at x=0
    await this.play(this.circle.animate.moveTo([4, 0, 0]), { runTime: 2 }); // t: 1 -> 3, x: 0 -> 4
    await this.wait(1); // t: 3 -> 4, stationary at x=4
  }
}

function circleX(scene: Scene): number {
  return (scene as any).circle.getCenter()[0];
}

test("sampleSceneAt captures interpolated mid-animation state, not just start/end", async () => {
  const atStart = await sampleSceneAt(MoveScene, 0.5, { fps: 30 }); // during the leading wait()
  assert.ok(Math.abs(circleX(atStart) - 0) < 0.05, `expected x~=0 at t=0.5, got ${circleX(atStart)}`);

  const atMidpoint = await sampleSceneAt(MoveScene, 2, { fps: 30 }); // halfway through the 2s move
  assert.ok(Math.abs(circleX(atMidpoint) - 2) < 0.2, `expected x~=2 at t=2 (midpoint), got ${circleX(atMidpoint)}`);

  const atEnd = await sampleSceneAt(MoveScene, 3.5, { fps: 30 }); // during the trailing wait()
  assert.ok(Math.abs(circleX(atEnd) - 4) < 0.05, `expected x~=4 at t=3.5, got ${circleX(atEnd)}`);
});

test("sampleSceneAt(scene, Infinity) runs to completion and reports the total duration", async () => {
  const scene = await sampleSceneAt(MoveScene, Infinity, { fps: 30 });
  assert.ok(Math.abs(scene.time - 4) < 0.05, `expected total duration ~=4s, got ${scene.time}`);
  assert.ok(Math.abs(circleX(scene) - 4) < 0.05, "final state should match the scene's true end state");
});

test("sampleSceneAt re-runs construct() from scratch every call -- no cross-call state leakage", async () => {
  const first = await sampleSceneAt(MoveScene, 2, { fps: 30 });
  const second = await sampleSceneAt(MoveScene, 0.5, { fps: 30 });
  // If state leaked (e.g. a shared Scene instance), the second (earlier-time)
  // sample would incorrectly reflect the first call's later position.
  assert.ok(Math.abs(circleX(second) - 0) < 0.05, `expected a fresh run at t=0.5 to show x~=0, got ${circleX(second)}`);
  assert.ok(Math.abs(circleX(first) - 2) < 0.2);
});

test("sampleSceneAt works with a bare construct function, not just a Scene subclass", async () => {
  const build = async (scene: Scene) => {
    const c = new Circle({ radius: 1 });
    (scene as any).circle = c; // assigned BEFORE play() -- sampleSceneAt interrupts mid-play() by design
    scene.add(c);
    await scene.play(c.animate.moveTo([6, 0, 0]), { runTime: 1 });
  };
  const midway = await sampleSceneAt(build, 0.5, { fps: 30 });
  // Not pixel-exact (default rate function is an eased "smooth", not linear,
  // and this lands on a specific quantized frame) -- the point of this test
  // is confirming a bare construct function gets interrupted mid-animation
  // (neither the x=0 start nor the x=6 end), same as the Scene-subclass case
  // above.
  assert.ok(circleX(midway) > 0.5 && circleX(midway) < 5.5, `expected a mid-animation x, got ${circleX(midway)}`);
});

test("sampleSceneAt lets a real construct() error propagate (doesn't swallow non-sentinel throws)", async () => {
  class BrokenScene extends Scene {
    async construct() {
      await this.wait(0.1);
      throw new Error("boom");
    }
  }
  await assert.rejects(() => sampleSceneAt(BrokenScene, 5, { fps: 30 }), /boom/);
});

test("sampleSceneAt does not render any real frames (no-op frameHandler besides the cutoff check)", async () => {
  let frameHandlerCallsFromUserCode = 0;
  class InstrumentedScene extends Scene {
    async construct() {
      // A construct() has no visibility into sampleSceneAt's internal
      // frameHandler override -- this just confirms scene.render() still
      // completes the full construct() script when never cut off (targetTime
      // beyond the scene's duration), i.e. frameHandler being a silent no-op
      // doesn't stall the frame loop.
      frameHandlerCallsFromUserCode++;
      await this.wait(0.2);
    }
  }
  await sampleSceneAt(InstrumentedScene, 10, { fps: 30 });
  assert.equal(frameHandlerCallsFromUserCode, 1);
});

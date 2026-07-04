import { test } from "node:test";
import assert from "node:assert/strict";

import { Player } from "../src/player.ts";
import { Scene } from "../src/scene/Scene.ts";
import { Circle } from "../src/mobject/geometry.ts";

test("Player.record(SceneSubclass, { props }) threads props into the Scene's own config.props", async () => {
  const seen: any[] = [];
  class MyScene extends Scene {
    constructor(config: any = {}) {
      super(config);
      seen.push(config.props);
    }
    async construct(): Promise<void> {
      this.add(new Circle());
      await this.wait(0.01);
    }
  }

  const p = new Player({ fps: 10, pixelWidth: 16, pixelHeight: 16 });
  await p.record(MyScene, { props: { color: "red" } });
  assert.deepEqual(seen, [{ color: "red" }]);
  assert.ok(p.frames.length > 0);
});

test("Player.record(bareConstructFn, { props }) passes props as the construct function's 2nd argument", async () => {
  const seen: any[] = [];
  async function construct(scene: Scene, props: any): Promise<void> {
    seen.push(props);
    scene.add(new Circle());
    await scene.wait(0.01);
  }

  const p = new Player({ fps: 10, pixelWidth: 16, pixelHeight: 16 });
  await p.record(construct, { props: { size: 3 } });
  assert.deepEqual(seen, [{ size: 3 }]);
  assert.ok(p.frames.length > 0);
});

test("Player.record() without opts.props is unaffected (backward compatible)", async () => {
  const seen: any[] = [];
  async function construct(scene: Scene, props: any): Promise<void> {
    seen.push(props);
    scene.add(new Circle());
  }
  const p = new Player({ fps: 10, pixelWidth: 16, pixelHeight: 16 });
  await p.record(construct);
  assert.deepEqual(seen, [undefined]);
});

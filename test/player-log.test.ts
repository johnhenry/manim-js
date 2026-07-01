import { test } from "node:test";
import assert from "node:assert/strict";

import { Scene } from "../src/scene/Scene.ts";
import { Camera } from "../src/renderer/CanvasRenderer.ts";
import { Circle } from "../src/mobject/geometry.ts";
import { Create } from "../src/animation/Animation.ts";
import { Player } from "../src/player.ts";

// A tiny scene with a couple of frames.
class Tiny extends Scene {
  async construct() {
    const c = new Circle({ radius: 1 });
    // A short animation: 2 frames at fps=30 -> runTime ~= 2/30s.
    const anim = new Create(c);
    (anim as any).runTime = 2 / this.fps;
    await this.play(anim);
  }
}

test("Scene.onLog receives a 'play' log when play() runs", async () => {
  const logs: Array<{ level: string; msg: string; data?: any }> = [];
  const scene = new Tiny({ fps: 30 });
  scene.frameHandler = async () => {};
  scene.onLog = (level, msg, data) => logs.push({ level, msg, data });

  await scene.render();

  const play = logs.find((l) => l.level === "play");
  assert.ok(play, "a log with level 'play' was emitted");
  assert.ok(play!.data && typeof play!.data.count === "number", "play log carries an animation count");
  assert.ok(play!.data.count >= 1, "at least one animation reported");
  assert.ok(typeof play!.data.runTime === "number", "play log carries a runTime");
});

test("Scene.log is a no-op (no crash) when onLog is unset", async () => {
  const scene = new Tiny({ fps: 30 });
  scene.frameHandler = async () => {};
  // onLog intentionally left unset.
  await assert.doesNotReject(scene.render());
  assert.ok(scene.frameCount > 0, "scene still emitted frames with logging off");
});

test("Player constructs and records a 2-frame scene into frames[]", async () => {
  const player = new Player({ pixelWidth: 64, pixelHeight: 48, fps: 30 });
  assert.strictEqual(player.frameCount, 0, "starts empty");

  // A bare construct function that emits exactly 2 frames.
  const expected = 2;
  await player.record(async (scene: Scene) => {
    const c = new Circle({ radius: 0.5 });
    scene.add(c);
    for (let i = 0; i < expected; i++) await scene.emitFrame();
  });

  assert.strictEqual(player.frameCount, expected, "recorded the expected frame count");
  assert.ok(player.frames[0].width === 64 && player.frames[0].height === 48, "frames carry dims");
  assert.strictEqual(player.duration, expected / 30, "duration derives from fps + frame count");
  assert.doesNotThrow(() => player.seek(1), "seek() does not throw");
  assert.doesNotThrow(() => player.seekTime(0), "seekTime() does not throw");
  assert.strictEqual(player.currentFrame, 0, "seekTime(0) lands on frame 0");
});

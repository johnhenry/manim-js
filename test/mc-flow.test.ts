// MC2 (Motion Canvas parity campaign): waitUntil named time events with
// config-driven durations, spawn() background tasks (cancel/join),
// loopForever(), and determinism of the background channel.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Scene } from "../src/scene/Scene.ts";
import { Circle } from "../src/mobject/geometry.ts";
import { ApplyMethod } from "../src/animation/Animation.ts";
import { Rotate } from "../src/animation/extra.ts";

const close = (a: number, b: number, eps = 1e-6, msg?: string) =>
  assert.ok(Math.abs(a - b) < eps, msg ?? `${a} !~ ${b}`);

const silentScene = (config: any = {}) =>
  new Scene({ fps: 20, frameHandler: async () => {}, ...config });

// ApplyMethod's trailing-config detection needs the `_animConfig` marker, so
// set runTime explicitly (same pattern as moving_camera_scene.ts).
function applyIn(mob: any, fn: (this: any) => void, runTime: number) {
  const anim = new ApplyMethod(mob, fn);
  anim.runTime = runTime;
  return anim;
}

function rotateIn(mob: any, angle: number, runTime: number) {
  const anim = new Rotate(mob, { angle });
  anim.runTime = runTime;
  return anim;
}

// --- waitUntil ---------------------------------------------------------------

test("waitUntil holds the fallback duration and records the event", async () => {
  const scene = silentScene();
  await scene.waitUntil("intro", 0.5);
  close(scene.time, 0.5, 1e-9, "held 0.5s");
  assert.equal(scene.timeEventRecords.length, 1);
  assert.equal(scene.timeEventRecords[0].name, "intro");
  close(scene.timeEventRecords[0].time, 0, 1e-9, "event started at t=0");
});

test("SceneConfig.timeEvents overrides waitUntil fallbacks (editor-less retiming)", async () => {
  const scene = silentScene({ timeEvents: { intro: 1.5, skip: 0 } });
  await scene.waitUntil("intro", 0.5);
  close(scene.time, 1.5, 1e-9, "config duration wins over fallback");
  await scene.waitUntil("skip", 2);
  close(scene.time, 1.5, 1e-9, "zero-duration event holds nothing");
  await scene.waitUntil("unnamed", 0.25);
  close(scene.time, 1.75, 1e-9, "unconfigured event uses its fallback");
});

// --- spawn -------------------------------------------------------------------

test("a spawned task advances during foreground wait() and finishes", async () => {
  const scene = silentScene();
  const dot = new Circle({ radius: 0.2 });
  scene.add(dot);
  const task = scene.spawn(function* () {
    yield applyIn(dot, function (this: any) { this.moveTo([2, 0, 0]); }, 0.5);
  });
  assert.equal(task.done, false);
  await scene.wait(1);
  assert.equal(task.done, true, "task exhausted during the wait");
  close(dot.getCenter()[0], 2, 1e-6, "background animation landed");
});

test("multi-step tasks flow through numbers (idle) and chained animations", async () => {
  const scene = silentScene();
  const dot = new Circle({ radius: 0.2 });
  scene.add(dot);
  const seen: number[] = [];
  scene.spawn(function* () {
    yield 0.25;                       // idle quarter second
    seen.push(scene.time);
    yield applyIn(dot, function (this: any) { this.moveTo([1, 0, 0]); }, 0.25);
    seen.push(scene.time);
  });
  await scene.wait(1);
  assert.equal(seen.length, 2, "both steps ran");
  close(seen[0], 0.25, 0.06, "idle consumed ~0.25s");
  close(seen[1], 0.5, 0.06, "animation consumed the next ~0.25s");
});

test("cancel() stops a task mid-flight; join() drives frames to completion", async () => {
  const scene = silentScene();
  const dot = new Circle({ radius: 0.2 });
  scene.add(dot);

  const infinite = scene.spawn(function* () {
    for (;;) yield rotateIn(dot, Math.PI, 1);
  });
  await scene.wait(0.25);
  infinite.cancel();
  assert.equal(infinite.done, true);
  const t = scene.time;
  await infinite.join(); // already done: resolves without advancing time
  close(scene.time, t, 1e-9, "join on a canceled task is instant");

  const finite = scene.spawn(function* () {
    yield 0.4;
  });
  await finite.join();
  assert.equal(finite.done, true, "join ran the scene until the task finished");
  assert.ok(scene.time >= t + 0.4 - 1e-6, "join emitted enough frames");
});

test("loopForever repeats the factory animation until canceled", async () => {
  const scene = silentScene();
  const dot = new Circle({ radius: 0.2 });
  scene.add(dot);
  let builds = 0;
  const loop = scene.loopForever(() => {
    builds++;
    return rotateIn(dot, Math.PI / 2, 0.25);
  });
  await scene.wait(1);
  assert.ok(builds >= 4, `~4 loop iterations in 1s (got ${builds})`);
  loop.cancel();
  const b = builds;
  await scene.wait(0.5);
  assert.equal(builds, b, "no more builds after cancel");
});

test("a zero-duration-forever generator cannot hang the frame loop (pull cap)", async () => {
  const scene = silentScene();
  scene.spawn(function* () {
    for (;;) yield 0;
  });
  await scene.wait(0.1); // must return, not spin forever
  assert.ok(scene.time >= 0.1 - 1e-9);
});

test("background tasks tick during play() too, in lockstep with the clock", async () => {
  const scene = silentScene();
  const fg = new Circle({ radius: 0.5 });
  const bg = new Circle({ radius: 0.2 });
  scene.add(fg, bg);
  scene.spawn(function* () {
    yield applyIn(bg, function (this: any) { this.moveTo([0, 3, 0]); }, 0.5);
  });
  await scene.play(applyIn(fg, function (this: any) { this.moveTo([3, 0, 0]); }, 0.5));
  close(fg.getCenter()[0], 3, 1e-6, "foreground landed");
  close(bg.getCenter()[1], 3, 1e-6, "background landed in the same play window");
});

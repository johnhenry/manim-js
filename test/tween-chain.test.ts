// MC1 (Motion Canvas parity campaign): chainable tweens, signal tweens,
// imperative tween(), spring presets, useRandom, Scene.nextFrame/logger.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tweenTo, tweenSignal, tween, map, springTween, useRandom, PlopSpring,
} from "../src/animation/tween_chain.ts";
import { createSignal, computed } from "../src/reactive/signal.ts";
import { Circle, Square } from "../src/mobject/geometry.ts";
import { Scene } from "../src/scene/Scene.ts";

const silentScene = () => new Scene({ fps: 20, frameHandler: async () => {} });

test("tweenTo chains through segments: to().to() lands each target in order", async () => {
  const scene = silentScene();
  const c = new Circle({ radius: 1 });
  scene.add(c);
  const chain = tweenTo(c, { x: 300 }, 1).to({ x: -300 }, 1);
  assert.ok(Math.abs(chain.runTime - 2) < 1e-9, "runTime = sum of segment durations");
  chain.begin();
  chain.interpolate(0.5); // end of segment 1
  assert.ok(Math.abs(c.getCenter()[0] - 300) < 1, `mid-chain at 300 (got ${c.getCenter()[0]})`);
  chain.finish();
  assert.ok(Math.abs(c.getCenter()[0] + 300) < 1e-6, "chain ends at -300");
});

test("wait() holds and back() returns to the chain-start state", () => {
  const c = new Circle({ radius: 1 });
  c.moveTo([5, 2, 0]);
  const chain = tweenTo(c, { x: -5 }, 1).wait(1).back(1);
  chain.begin();
  chain.interpolate(1 / 3);
  assert.ok(Math.abs(c.getCenter()[0] + 5) < 1e-6, "segment 1 target");
  chain.interpolate(2 / 3);
  assert.ok(Math.abs(c.getCenter()[0] + 5) < 1e-6, "wait holds");
  chain.finish();
  assert.ok(Math.abs(c.getCenter()[0] - 5) < 1e-6, "back() restores chain start x");
  assert.ok(Math.abs(c.getCenter()[1] - 2) < 1e-6, "y untouched throughout");
});

test("multi-prop segments tween color and opacity together", () => {
  const sq = new Square({ sideLength: 1, fillOpacity: 1, color: "#FF0000" });
  const chain = tweenTo(sq, { fill: "#0000FF", opacity: 0.5 }, 1);
  chain.begin();
  chain.interpolate(1);
  assert.equal((sq as any).fillColor.toHex().toUpperCase(), "#0000FF");
  assert.ok(Math.abs((sq.opacity ?? 1) - 0.5) < 1e-6);
});

test("rotation and scale tween as absolute values via deltas", () => {
  const sq = new Square({ sideLength: 2 });
  const chain = tweenTo(sq, { scale: 2 }, 1).to({ scale: 1 }, 1).to({ rotation: Math.PI / 2 }, 1);
  chain.begin();
  chain.interpolate(1 / 3);
  assert.ok(Math.abs(sq.getWidth() - 4) < 1e-6, "scaled to 2x");
  chain.interpolate(2 / 3);
  assert.ok(Math.abs(sq.getWidth() - 2) < 1e-6, "back to 1x");
  chain.finish();
  assert.ok(Math.abs(sq.getWidth() - 2) < 1e-6, "rotation leaves size alone (square)");
});

test("tweenSignal drives a signal (and its computed dependents) per frame", async () => {
  const radius = createSignal(1);
  const area = computed(() => Math.PI * radius() * radius());
  const anim = tweenSignal(radius, 2, 1).wait(0.5);
  anim.begin();
  anim.interpolate(2 / 3); // end of tween segment
  assert.ok(Math.abs(radius() - 2) < 1e-9);
  assert.ok(Math.abs(area() - Math.PI * 4) < 1e-9, "computed follows");
  // Plays through a scene too.
  const scene = silentScene();
  await scene.play(tweenSignal(radius, 0.5, 0.2));
  assert.ok(Math.abs(radius() - 0.5) < 1e-9);
});

test("tween(duration, cb) sweeps eased t and map() lerps", async () => {
  const seen: number[] = [];
  const scene = silentScene();
  await scene.play(tween(0.3, (t) => seen.push(map(-300, 300, t))));
  assert.ok(seen.length > 2);
  assert.ok(Math.abs(seen[seen.length - 1] - 300) < 1e-6, "ends at map(...,1)");
  assert.ok(seen[0] <= -200, "starts near map(...,0)");
});

test("springTween drives the callback with overshoot character", async () => {
  const values: number[] = [];
  const scene = silentScene();
  await scene.play(springTween(PlopSpring, 0, 100, (v) => values.push(v)));
  const peak = Math.max(...values);
  assert.ok(peak > 105, `plop overshoots (peak ${peak.toFixed(1)})`);
  assert.ok(Math.abs(values[values.length - 1] - 100) < 2, "settles at target");
});

test("useRandom is deterministic with MC's method surface", () => {
  const a = useRandom(4);
  const b = useRandom(4);
  assert.equal(a.nextInt(2, 4), b.nextInt(2, 4));
  assert.deepEqual(a.intArray(5, 0, 10), b.intArray(5, 0, 10));
  const f = useRandom(7).nextFloat(-500, 500);
  assert.ok(f >= -500 && f < 500);
  const ints = useRandom(1).intArray(200, 0, 10);
  assert.ok(ints.every((i) => Number.isInteger(i) && i >= 0 && i < 10), "nextInt upper-exclusive");
  const g = useRandom(9).gauss(0, 1);
  assert.ok(Number.isFinite(g));
});

test("Scene.nextFrame advances exactly one frame; logger routes to onLog", async () => {
  const frames: number[] = [];
  const scene = new Scene({ fps: 20, frameHandler: async () => { frames.push(1); } });
  await scene.nextFrame();
  assert.equal(frames.length, 1, "exactly one frame emitted");
  assert.ok(Math.abs(scene.time - 1 / 20) < 1e-9);
  const logged: string[] = [];
  scene.onLog = (level, msg) => logged.push(`${level}:${msg}`);
  scene.logger.debug("hello");
  scene.logger.info("world");
  assert.deepEqual(logged, ["debug:hello", "info:world"]);
});

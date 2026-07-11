// addUpdater(fn, {hashExtra}) — an opt-in cache-safety escape hatch (see
// Mobject.ts's JSDoc on addUpdater for the full rationale): a fixed-step
// simulation's updater closure can capture tunable state (a boids flock's
// perceptionRadius, a spring's damping) that changes what a wait() holds on
// without changing anything the partial-movie cache's fingerprint otherwise
// sees (position/paint/opacity of the mobject itself). Without hashExtra,
// tuning such a parameter mid-iteration can silently replay a stale cached
// segment (found porting the p5.js campaign's boids/soft-body demos).
//
// Mechanism: hashExtra is attached as a property on the updater function
// itself (mirroring how Animation's own _hashExtra() lives directly on the
// animation instance), read back by Scene's _mobjectFingerprint() — which
// backs BOTH _sceneContentFingerprint() (every wait()) and
// _untouchedMobjectsFingerprint() (play()'s fix for unanimated siblings,
// see test/hash-invalidation.test.ts) — so one mechanism covers both paths.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Scene } from "../src/scene/Scene.ts";
import { Circle } from "../src/mobject/geometry.ts";
import { FadeIn } from "../src/animation/Animation.ts";

async function waitHash(param: number): Promise<string> {
  const s = new Scene({ fps: 30 });
  const a = new Circle({ radius: 1 });
  s.add(a);
  a.addUpdater(() => {}, { hashExtra: () => `param:${param}` });
  await s.wait(0.05);
  return s.playRecords[s.playRecords.length - 1].hash;
}

test("wait(): a different hashExtra value changes the segment hash", async () => {
  assert.notEqual(await waitHash(5), await waitHash(10));
});

test("wait(): the SAME hashExtra value still produces the SAME hash (cache reuse preserved)", async () => {
  assert.equal(await waitHash(5), await waitHash(5));
});

test("wait(): a plain addUpdater(fn) with no config still works (hashExtra is optional)", async () => {
  const s = new Scene({ fps: 30 });
  const a = new Circle({ radius: 1 });
  s.add(a);
  a.addUpdater(() => {});
  await s.wait(0.05);
  assert.equal(s.playRecords.length, 1);
});

async function playHashUntouchedSim(param: number): Promise<string> {
  const s = new Scene({ fps: 30 });
  const a = new Circle({ radius: 1 });
  const sim = new Circle({ radius: 1 }); // NOT animated by the play() below
  s.add(a, sim);
  sim.addUpdater(() => {}, { hashExtra: () => `simParam:${param}` });
  await s.play(new FadeIn(a));
  return s.playRecords[s.playRecords.length - 1].hash;
}

test("play(): hashExtra on an UNANIMATED sibling's updater also changes the hash (closes the same blind spot for play(), not just wait())", async () => {
  assert.notEqual(await playHashUntouchedSim(5), await playHashUntouchedSim(10));
});

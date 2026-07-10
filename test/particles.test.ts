// ParticleSystem (src/mobject/particles.ts): every particle is a closed-form
// function of (seed, index, time) — determinism under shuffled sampling,
// the maxParticles cap, lifetime death, the analytic ballistic solution,
// colorRamp endpoints, and burst cohorts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ParticleSystem } from "../src/mobject/particles.ts";
import { CanvasRenderer, Camera } from "../src/renderer/CanvasRenderer.ts";

const snapshot = (ps: ParticleSystem, t: number) =>
  ps.sampleParticles(t).map((p) => ({ ...p, color: p.color.toHex() }));

test("sampling times in shuffled order yields identical states (no hidden state)", () => {
  const mk = () => new ParticleSystem({ rate: 30, seed: 7, gravity: -2, drag: 0.4, spread: Math.PI });
  const a = mk();
  const b = mk();
  const times = [0.5, 2.0, 0.1, 1.3, 0.5, 3.7, 0.9];
  const fromA = new Map(times.map((t) => [t, JSON.stringify(snapshot(a, t))]));
  for (const t of [...times].reverse()) {
    assert.equal(JSON.stringify(snapshot(b, t)), fromA.get(t), `state at t=${t} differs`);
  }
});

test("maxParticles caps the continuous stream", () => {
  const ps = new ParticleSystem({ rate: 1000, lifetime: 100, maxParticles: 50 });
  assert.equal(ps.sampleParticles(10).length, 50);
});

test("particles die at the end of their lifetime", () => {
  const ps = new ParticleSystem({ rate: 10, lifetime: [1, 1] });
  // At t=0.5: particles born at 0..0.5 → 6 alive (i/10 for i=0..5).
  assert.equal(ps.sampleParticles(0.5).length, 6);
  // At t=1.05: born 0.1..1.0 alive (i=1..10); i=0 died at t=1.
  assert.equal(ps.sampleParticles(1.05).length, 10);
  // Far future with rate-limited emission all dead: cap emission via maxParticles.
  const finite = new ParticleSystem({ rate: 10, lifetime: [1, 1], maxParticles: 20 });
  assert.equal(finite.sampleParticles(100).length, 0, "all cohorts expired");
});

test("drag-free ballistic position matches p0 + v0*t + g*t^2/2 to 1e-9", () => {
  // Single deterministic particle: rate 1, zero spread, fixed speed/lifetime.
  const ps = new ParticleSystem({
    rate: 1, lifetime: [4, 4], speed: [2, 2], direction: 0, spread: 0,
    gravity: [0.5, -1.5], emitterPoint: [1, 2, 0],
  });
  const t = 1.7;
  const [p] = ps.sampleParticles(t); // particle 0, born at 0, age = t
  const ex = 1 + 2 * t + (0.5 * t * t) / 2;
  const ey = 2 + 0 * t + (-1.5 * t * t) / 2;
  assert.ok(Math.abs(p.x - ex) < 1e-9, `x ${p.x} vs ${ex}`);
  assert.ok(Math.abs(p.y - ey) < 1e-9, `y ${p.y} vs ${ey}`);
});

test("dragged ballistic position matches the analytic closed form to 1e-9", () => {
  const k = 0.8;
  const g: [number, number] = [0, -2];
  const ps = new ParticleSystem({
    rate: 1, lifetime: [4, 4], speed: [3, 3], direction: Math.PI / 2, spread: 0,
    gravity: g, drag: k,
  });
  const t = 2.1;
  const [p] = ps.sampleParticles(t);
  const decay = (1 - Math.exp(-k * t)) / k;
  const ex = 0 + (0 - g[0] / k) * decay + (g[0] / k) * t;
  const ey = 0 + (3 - g[1] / k) * decay + (g[1] / k) * t;
  assert.ok(Math.abs(p.x - ex) < 1e-9);
  assert.ok(Math.abs(p.y - ey) < 1e-9);
});

test("colorRamp endpoints: birth color at life~0, last stop approached at life~1", () => {
  const ps = new ParticleSystem({
    rate: 1, lifetime: [1, 1], colorRamp: ["#FF0000", "#0000FF"], opacity: [1, 1],
  });
  const young = ps.sampleParticles(0.001)[0];
  assert.ok(young.color.r > 0.99 && young.color.b < 0.01, "starts red");
  const old = ps.sampleParticles(0.999)[0];
  assert.ok(old.color.b > 0.99 && old.color.r < 0.01, "ends blue");
});

test("bursts are deterministic cohorts independent of registration timing", () => {
  const mk = () => {
    const ps = new ParticleSystem({ rate: 0, seed: 3, lifetime: [2, 2] });
    ps.burst(1.0, 25, { speed: [4, 6] });
    ps.burst(2.5, 10 );
    return ps;
  };
  const a = mk();
  const b = mk();
  // Nothing before the first burst; cohort sizes appear at their times.
  assert.equal(a.sampleParticles(0.5).length, 0);
  assert.equal(a.sampleParticles(1.5).length, 25);
  assert.equal(a.sampleParticles(2.6).length, 35);
  // b sampled in a different order gives identical states.
  assert.equal(JSON.stringify(snapshot(b, 2.6)), JSON.stringify(snapshot(a, 2.6)));
  // copy() doesn't alias the burst list.
  const c = a.copy();
  c.burst(5, 99);
  assert.equal(a.sampleParticles(5.1).length, snapshot(b, 5.1).length);
});

test("autoAdvance accumulates scene time; setTime scrubs both directions", () => {
  const ps = new ParticleSystem({ rate: 10, lifetime: [1, 1] });
  for (let i = 0; i < 33; i++) ps.update(1 / 60); // 0.55s of scene time
  assert.ok(Math.abs(ps.time - 0.55) < 1e-9);
  assert.equal(ps.sampleParticles().length, 6); // births 0, 0.1 ... 0.5
  ps.setTime(0.05);
  assert.equal(ps.sampleParticles().length, 1);
});

test("renderer rasterizes particles directly (fills, not mobjects)", () => {
  const calls: string[] = [];
  const fakeCtx: any = new Proxy({}, {
    get: (_t, prop: string) => {
      if (prop === "canvas") return { width: 320, height: 180 };
      return (..._args: any[]) => { calls.push(prop); };
    },
    set: () => true,
  });
  const camera = new Camera({ pixelWidth: 320, pixelHeight: 180 });
  const renderer = new CanvasRenderer(fakeCtx, camera);
  const ps = new ParticleSystem({ rate: 20, lifetime: [5, 5], shape: "circle" });
  ps.setTime(1); // 21 live particles
  renderer.renderMobjects([ps]);
  const arcs = calls.filter((c) => c === "arc").length;
  assert.equal(arcs, 21, `expected one arc per live particle, got ${arcs}`);
});

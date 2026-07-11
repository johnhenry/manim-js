import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScrollProgress, bindScroll, bindPlayerToScroll, Player } from "../src/player.ts";

// =============================================================================
// Pure math: computeScrollProgress(). No DOM involved -- this is the primitive
// the whole scroll-binding feature is built on (see the comment block above
// it in src/player.ts for the full formula + mini-DSL notes). Formula:
//
//   startY/endY resolved from `start`/`end` (number | "<edge> <viewportEdge>"
//   | "+=N"/"-=N" relative to start), defaulting to "top top"/"bottom top".
//   progress = clamp((scrollY - startY) / (endY - startY), 0, 1)
// =============================================================================

test("computeScrollProgress: numeric start/end -- 0 before, linear between, 1 after", () => {
  const base = { elementTop: 1000, elementHeight: 400, viewportHeight: 800 };
  assert.equal(computeScrollProgress({ ...base, scrollY: 0, start: 1000, end: 1400 }), 0);
  assert.equal(computeScrollProgress({ ...base, scrollY: 1000, start: 1000, end: 1400 }), 0);
  assert.equal(computeScrollProgress({ ...base, scrollY: 1100, start: 1000, end: 1400 }), 0.25);
  assert.equal(computeScrollProgress({ ...base, scrollY: 1200, start: 1000, end: 1400 }), 0.5);
  assert.equal(computeScrollProgress({ ...base, scrollY: 1400, start: 1000, end: 1400 }), 1);
  assert.equal(computeScrollProgress({ ...base, scrollY: 2000, start: 1000, end: 1400 }), 1);
  assert.equal(computeScrollProgress({ ...base, scrollY: -500, start: 1000, end: 1400 }), 0);
});

test("computeScrollProgress: default start/end (\"top top\" .. \"bottom top\") spans one elementHeight", () => {
  // elementTop=1000, elementHeight=400, viewportHeight=800
  // start "top top"    -> elementRef=1000+0,   viewportRef=0   -> 1000
  // end   "bottom top" -> elementRef=1000+400, viewportRef=0   -> 1400
  const base = { elementTop: 1000, elementHeight: 400, viewportHeight: 800 };
  assert.equal(computeScrollProgress({ ...base, scrollY: 999 }), 0);
  assert.equal(computeScrollProgress({ ...base, scrollY: 1000 }), 0);
  assert.equal(computeScrollProgress({ ...base, scrollY: 1200 }), 0.5);
  assert.equal(computeScrollProgress({ ...base, scrollY: 1400 }), 1);
  assert.equal(computeScrollProgress({ ...base, scrollY: 1401 }), 1);
});

test("computeScrollProgress: \"<edge> <viewportEdge>\" DSL resolves the ScrollTrigger formula", () => {
  // elementTop=500, elementHeight=200, viewportHeight=1000
  // "top bottom":     elementRef=500+0,   viewportRef=1000       -> -500
  // "center center":  elementRef=500+100, viewportRef=500        -> 100
  // "bottom top":     elementRef=500+200, viewportRef=0          -> 700
  const geo = { elementTop: 500, elementHeight: 200, viewportHeight: 1000 };
  assert.equal(computeScrollProgress({ ...geo, scrollY: -500, start: "top bottom", end: "bottom top" }), 0);
  assert.equal(computeScrollProgress({ ...geo, scrollY: 100, start: "top bottom", end: "bottom top" }), 0.5);
  assert.equal(computeScrollProgress({ ...geo, scrollY: 700, start: "top bottom", end: "bottom top" }), 1);
  assert.equal(computeScrollProgress({ ...geo, scrollY: 100, start: "center center" }), 0);
});

test("computeScrollProgress: \"+=N\" end is relative to the resolved start", () => {
  const geo = { elementTop: 0, elementHeight: 0, viewportHeight: 0 };
  // start "top top" -> 0; end "+=800" -> 800 (mirrors the ref docs' `end: "+=800"`).
  assert.equal(computeScrollProgress({ ...geo, scrollY: 0, start: "top top", end: "+=800" }), 0);
  assert.equal(computeScrollProgress({ ...geo, scrollY: 400, start: "top top", end: "+=800" }), 0.5);
  assert.equal(computeScrollProgress({ ...geo, scrollY: 800, start: "top top", end: "+=800" }), 1);
});

test("computeScrollProgress: \"-=N\" subtracts (start relative to 0; end relative to the resolved start)", () => {
  const geo = { elementTop: 0, elementHeight: 0, viewportHeight: 0 };
  // start "-=200" -> 0 + (-200) = -200. end "+=200" -> startY(-200) + 200 = 0.
  assert.equal(computeScrollProgress({ ...geo, scrollY: -200, start: "-=200", end: "+=200" }), 0);
  assert.equal(computeScrollProgress({ ...geo, scrollY: -100, start: "-=200", end: "+=200" }), 0.5);
  assert.equal(computeScrollProgress({ ...geo, scrollY: 0, start: "-=200", end: "+=200" }), 1);
});

test("computeScrollProgress: degenerate zero/negative-length range doesn't divide by zero", () => {
  assert.equal(computeScrollProgress({ elementTop: 0, elementHeight: 0, viewportHeight: 0, scrollY: -1, start: 100, end: 100 }), 0);
  assert.equal(computeScrollProgress({ elementTop: 0, elementHeight: 0, viewportHeight: 0, scrollY: 100, start: 100, end: 100 }), 1);
  assert.equal(computeScrollProgress({ elementTop: 0, elementHeight: 0, viewportHeight: 0, scrollY: 50, start: 100, end: 0 }), 0);
});

// =============================================================================
// Player.seekFraction() -- pure, no DOM needed. This is the piece
// bindPlayerToScroll() drives from scroll progress (pattern 07).
// =============================================================================

test("Player.seekFraction maps 0..1 to a frame index and clamps out-of-range input", () => {
  const p: any = new Player({ fps: 10 });
  p.frames = new Array(11).fill({ width: 1, height: 1 }); // frames 0..10
  p.seekFraction(0); assert.equal(p.currentFrame, 0);
  p.seekFraction(0.5); assert.equal(p.currentFrame, 5);
  p.seekFraction(1); assert.equal(p.currentFrame, 10);
  p.seekFraction(-1); assert.equal(p.currentFrame, 0);
  p.seekFraction(2); assert.equal(p.currentFrame, 10);
});

// =============================================================================
// Capability guard: bindScroll()/bindPlayerToScroll() must THROW a clear
// error under plain Node (no window/document), never silently no-op.
// =============================================================================

test("bindScroll throws a clear, documented error without window/document", () => {
  assert.equal(typeof (globalThis as any).window, "undefined");
  assert.equal(typeof (globalThis as any).document, "undefined");
  assert.throws(
    () => bindScroll({ trigger: {}, onProgress: () => {} }),
    /requires a browser DOM/,
  );
});

test("bindPlayerToScroll surfaces the same guard (it's built on bindScroll)", () => {
  const player = new Player({ fps: 10 });
  assert.throws(
    () => bindPlayerToScroll(player, { trigger: {} }),
    /requires a browser DOM/,
  );
});

// =============================================================================
// DOM-wiring test via a minimal fake `window`/element -- NOT a full DOM shim.
// bindScroll() only touches window.{addEventListener,removeEventListener,
// requestAnimationFrame,cancelAnimationFrame,scrollY,innerHeight} plus the
// trigger's getBoundingClientRect()/style, so a small hand-rolled stub is
// enough to exercise the real wiring logic (rAF-throttling, progress
// dedup, pin/unpin) without pulling in a browser or a DOM library -- that
// would be more machinery than this deserves. installFakeWindow() installs
// the stub on globalThis for the life of one test and restores it after.
//
// Note: bindScroll() deliberately re-checks `globalThis.window`/`.document`
// on every call (see the comment above its definition in player.ts) rather
// than a module-load-time constant, specifically so this kind of test can
// install the fake DOM *after* player.ts has already been imported.
// =============================================================================

function installFakeWindow() {
  const listeners: Record<string, Function[]> = { scroll: [], resize: [] };
  let rafQueue: Function[] = [];
  const fakeWindow: any = {
    scrollY: 0,
    innerHeight: 800,
    addEventListener(type: string, fn: Function) { (listeners[type] ??= []).push(fn); },
    removeEventListener(type: string, fn: Function) {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    requestAnimationFrame(fn: Function) { rafQueue.push(fn); return rafQueue.length; },
    cancelAnimationFrame() { /* rAF ids aren't tracked precisely -- unneeded for these assertions */ },
  };
  const prevWindow = (globalThis as any).window;
  const prevDocument = (globalThis as any).document;
  (globalThis as any).window = fakeWindow;
  (globalThis as any).document = {}; // only its *existence* is checked by the guard
  return {
    fireScroll(scrollY: number) { fakeWindow.scrollY = scrollY; for (const fn of [...listeners.scroll]) fn(); },
    flushRaf() { const q = rafQueue; rafQueue = []; for (const fn of q) fn(); },
    restore() {
      (globalThis as any).window = prevWindow;
      (globalThis as any).document = prevDocument;
    },
  };
}

function fakeTrigger(rect: { top: number; left: number; width: number; height: number }) {
  return { style: {} as Record<string, string | undefined>, getBoundingClientRect: () => rect };
}

test("bindScroll: rAF-throttled progress updates + pin/unpin lifecycle (fake DOM)", () => {
  const env = installFakeWindow();
  try {
    // trigger's natural document top = 1000 (rect.top=1000 while scrollY=0),
    // height=400, viewportHeight=800 -> default range start=1000, end=1400.
    const trigger = fakeTrigger({ top: 1000, left: 20, width: 300, height: 400 });
    const progressLog: number[] = [];
    const binding = bindScroll({ trigger, onProgress: (p) => progressLog.push(p), pin: true });

    // bindScroll() reports the initial state synchronously at setup time.
    assert.deepEqual(progressLog, [0]);
    assert.equal(trigger.style.position, undefined);

    // Multiple scroll events between animation frames collapse into ONE
    // recompute (rAF throttling) -- nothing fires until flushRaf().
    env.fireScroll(1000);
    env.fireScroll(1100);
    env.fireScroll(1200);
    assert.deepEqual(progressLog, [0]);
    env.flushRaf();
    assert.deepEqual(progressLog, [0, 0.5]);
    assert.equal(trigger.style.position, "fixed"); // now inside (0,1) -> pinned
    assert.equal(trigger.style.left, "20px");
    assert.equal(trigger.style.width, "300px");

    // Scrolling to the end of the range unpins and reports progress 1.
    env.fireScroll(1400);
    env.flushRaf();
    assert.deepEqual(progressLog, [0, 0.5, 1]);
    assert.equal(trigger.style.position, undefined); // restored to its pre-pin value

    binding.destroy();
  } finally {
    env.restore();
  }
});

test("bindPlayerToScroll (fake DOM): scroll progress drives Player.currentFrame both directions", () => {
  const env = installFakeWindow();
  try {
    const trigger = fakeTrigger({ top: 0, left: 0, width: 100, height: 500 });
    const player: any = new Player({ fps: 10 });
    player.frames = new Array(11).fill({ width: 1, height: 1 }); // frames 0..10

    // default range: start "top top" (0) .. end "bottom top" (elementTop+elementHeight=500)
    const binding = bindPlayerToScroll(player, { trigger });
    assert.equal(player.currentFrame, 0); // initial progress 0

    env.fireScroll(250); // progress 0.5
    env.flushRaf();
    assert.equal(player.currentFrame, 5);

    env.fireScroll(500); // progress 1 -- forward
    env.flushRaf();
    assert.equal(player.currentFrame, 10);

    env.fireScroll(100); // progress 0.2 -- scrolling back UP plays it backward
    env.flushRaf();
    assert.equal(player.currentFrame, 2);

    binding.destroy();
  } finally {
    env.restore();
  }
});

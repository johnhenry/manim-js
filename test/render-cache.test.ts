import { test } from "node:test";
import assert from "node:assert/strict";

import { CanvasRenderer, Camera } from "../src/renderer/CanvasRenderer.ts";
import { Circle } from "../src/mobject/geometry.ts";

// A minimal fake Ctx2D recording every call, mirroring the pattern used by
// other CanvasRenderer tests (test/renderer-interface.test.ts).
function makeFakeCtx(): any {
  const calls: string[] = [];
  const target: any = { calls };
  const handler = {
    get(t: any, prop: string) {
      if (prop in t) return t[prop];
      return (...args: any[]) => { calls.push(prop); };
    },
    set(t: any, prop: string, value: any) { t[prop] = value; return true; },
  };
  return new Proxy(target, handler);
}

// Node has no OffscreenCanvas/document -- stub a fake, SYNCHRONOUS one for
// the duration of each test, so the static-subtree cache's offscreen-canvas
// path is actually exercised (otherwise it would silently no-op here, same
// as it does under plain Node with no browser globals).
function withFakeOffscreenCanvas<T>(onCreate: () => void, fn: () => T): T {
  const g: any = globalThis as any;
  const had = "OffscreenCanvas" in g;
  const saved = g.OffscreenCanvas;
  g.OffscreenCanvas = class FakeOffscreenCanvas {
    width: number;
    height: number;
    private _ctx: any;
    constructor(w: number, h: number) {
      onCreate();
      this.width = w;
      this.height = h;
      this._ctx = makeFakeCtx();
    }
    getContext(_type: string): any {
      return this._ctx;
    }
  };
  try {
    return fn();
  } finally {
    if (had) g.OffscreenCanvas = saved;
    else delete g.OffscreenCanvas;
  }
}

function makeRenderer(): { renderer: CanvasRenderer; ctx: any; camera: Camera } {
  const camera = new Camera({ pixelWidth: 200, pixelHeight: 200, frameWidth: 8, frameHeight: 8 });
  const ctx = makeFakeCtx();
  const renderer = new CanvasRenderer(ctx, camera);
  return { renderer, ctx, camera };
}

test("a cacheStatic() mobject allocates one offscreen canvas on a cache miss, zero on a repeated identical frame", () => {
  let creations = 0;
  withFakeOffscreenCanvas(() => creations++, () => {
    const { renderer } = makeRenderer();
    const c = new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1 }).cacheStatic();

    renderer.renderMobjects([c]);
    assert.equal(creations, 1, "first frame is a cache miss: one offscreen canvas allocated + drawn into");

    renderer.renderMobjects([c]);
    assert.equal(creations, 1, "second identical frame is a cache hit: no new offscreen canvas, no path re-walk");

    renderer.renderMobjects([c]);
    assert.equal(creations, 1, "a third identical frame is still a cache hit");
  });
});

test("the real ctx receives a drawImage blit on a cache hit (not a beginPath/fill path walk)", () => {
  withFakeOffscreenCanvas(() => {}, () => {
    const { renderer, ctx } = makeRenderer();
    const c = new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1 }).cacheStatic();

    renderer.renderMobjects([c]); // miss: warms the cache
    ctx.calls.length = 0;
    renderer.renderMobjects([c]); // hit
    assert.deepEqual(ctx.calls, ["drawImage"]);
  });
});

test("cache invalidates on a point mutation (e.g. shift()), even though `points` keeps the same array reference", () => {
  let creations = 0;
  withFakeOffscreenCanvas(() => creations++, () => {
    const { renderer } = makeRenderer();
    const c = new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1 }).cacheStatic();

    renderer.renderMobjects([c]);
    assert.equal(creations, 1);

    const samePointsArrayRef = c.points;
    c.shift([0.5, 0, 0]);
    assert.equal(c.points, samePointsArrayRef, "shift() mutates points in place -- same outer array reference");

    renderer.renderMobjects([c]);
    assert.equal(creations, 2, "a content change must invalidate the cache even with reference-identical `points`");
  });
});

test("cache invalidates on a style mutation (fillColor)", () => {
  let creations = 0;
  withFakeOffscreenCanvas(() => creations++, () => {
    const { renderer } = makeRenderer();
    const c = new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1 }).cacheStatic();

    renderer.renderMobjects([c]);
    assert.equal(creations, 1);

    c.setColor("#FF0000");
    renderer.renderMobjects([c]);
    assert.equal(creations, 2, "a fillColor change must invalidate the cache");
  });
});

test("cache invalidates when the camera changes (frameCenter)", () => {
  let creations = 0;
  withFakeOffscreenCanvas(() => creations++, () => {
    const { renderer, camera } = makeRenderer();
    const c = new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1 }).cacheStatic();

    renderer.renderMobjects([c]);
    assert.equal(creations, 1);

    camera.frameCenter = [1, 0, 0];
    renderer.renderMobjects([c]);
    assert.equal(creations, 2, "a camera-state change must invalidate every cached mobject");
  });
});

test("a mobject without cacheStatic() draws normally every frame (opt-in, no behavior change by default)", () => {
  let creations = 0;
  withFakeOffscreenCanvas(() => creations++, () => {
    const { renderer, ctx } = makeRenderer();
    const c = new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1 }); // no .cacheStatic()

    renderer.renderMobjects([c]);
    renderer.renderMobjects([c]);
    assert.equal(creations, 0, "no offscreen canvas is ever created for a non-cached mobject");
    assert.ok(ctx.calls.some((call: string) => call === "fill"), "drew normally via the real ctx");
  });
});

test("caching gracefully no-ops without a synchronous offscreen-canvas backend (plain Node, no stub)", () => {
  const { renderer, ctx } = makeRenderer();
  const c = new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1 }).cacheStatic();
  assert.doesNotThrow(() => renderer.renderMobjects([c]));
  assert.ok(ctx.calls.some((call: string) => call === "fill"), "falls back to a normal, direct draw");
});

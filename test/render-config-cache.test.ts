// Confirmed bug, found while verifying the z-buffer anti-aliasing fix: the
// partial-segment cache key (Scene.hashAnimations()'s content hash) has no
// idea the RENDERER config changed between two render() calls for the same
// scene code -- re-rendering with a different background/resolution/3D
// camera setting silently reused a stale partial from a run with different
// config. Fixed via Scene.ts's computeRenderConfigHash(), salted into every
// partial filename in both node.ts (sequential) and node-parallel.ts.

import { test } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { computeRenderConfigHash } from "../src/scene/Scene.ts";
import { ThreeDCamera } from "../src/scene/three_d.ts";

test("computeRenderConfigHash() changes when background changes", () => {
  const a = computeRenderConfigHash({ pixelWidth: 1280, pixelHeight: 720, background: "#FF0000", fps: 30 });
  const b = computeRenderConfigHash({ pixelWidth: 1280, pixelHeight: 720, background: "#0000FF", fps: 30 });
  assert.notEqual(a, b);
});

test("computeRenderConfigHash() changes when resolution changes", () => {
  const a = computeRenderConfigHash({ pixelWidth: 1280, pixelHeight: 720, background: "#000", fps: 30 });
  const b = computeRenderConfigHash({ pixelWidth: 1920, pixelHeight: 1080, background: "#000", fps: 30 });
  assert.notEqual(a, b);
});

test("computeRenderConfigHash() is stable for identical config", () => {
  const cfg = { pixelWidth: 1280, pixelHeight: 720, background: "#123456", fps: 24, transparent: false };
  assert.equal(computeRenderConfigHash({ ...cfg }), computeRenderConfigHash({ ...cfg }));
});

test("computeRenderConfigHash() changes when a 3D camera's orientation changes", () => {
  const base = { pixelWidth: 1280, pixelHeight: 720, background: "#000", fps: 30 };
  const cam1 = new ThreeDCamera({ phi: 0.5, theta: -0.5 });
  const cam2 = new ThreeDCamera({ phi: 1.2, theta: -0.5 });
  assert.notEqual(
    computeRenderConfigHash({ ...base, camera: cam1 }),
    computeRenderConfigHash({ ...base, camera: cam2 }),
  );
});

test("computeRenderConfigHash() changes when superSample changes (this session's new anti-aliasing option)", () => {
  const base = { pixelWidth: 1280, pixelHeight: 720, background: "#000", fps: 30 };
  const cam1 = new ThreeDCamera({ phi: 0.5, theta: -0.5, superSample: 1 });
  const cam2 = new ThreeDCamera({ phi: 0.5, theta: -0.5, superSample: 2 });
  assert.notEqual(
    computeRenderConfigHash({ ...base, camera: cam1 }),
    computeRenderConfigHash({ ...base, camera: cam2 }),
  );
});

test("computeRenderConfigHash() ignores a plain (non-3D) camera's fields -- no projectionDepth means no camera-specific salt", () => {
  const base = { pixelWidth: 1280, pixelHeight: 720, background: "#000", fps: 30 };
  // Two unrelated plain objects passed as `camera` (no projectionDepth
  // method) should hash identically -- only a real 3D camera's fields count.
  assert.equal(
    computeRenderConfigHash({ ...base, camera: { foo: 1 } }),
    computeRenderConfigHash({ ...base, camera: { foo: 2 } }),
  );
});

test("end-to-end: render() does not reuse a cached segment when only the background changes", async () => {
  const { render } = await import("../src/node.ts");
  const { Circle } = await import("../src/mobject/geometry.ts");
  const dir = mkdtempSync(join(tmpdir(), "mjs-render-config-cache-"));
  const outRed = join(dir, "red.mp4");
  const outBlue = join(dir, "blue.mp4");

  const scene = async (s: any) => {
    s.add(new Circle({ radius: 1 }));
    await s.wait(0.1);
  };

  const redResult: any = await render(scene, { output: outRed, quality: "low", fps: 10, background: "#FF0000", verbose: false });
  const blueResult: any = await render(scene, { output: outBlue, quality: "low", fps: 10, background: "#0000FF", verbose: false });

  // The confirmed bug: blueResult would silently reuse red's cached segment.
  assert.equal(blueResult.reusedPartials ?? 0, 0, "a background-color change must not reuse the other config's cached segment");

  const pxAt = (file: string) => {
    // Downscale to a single pixel so the raw RGB24 output is exactly 3 bytes
    // (avoids ENOBUFS from a full-frame rawvideo pipe through execFileSync).
    const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vframes", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    return [raw[0], raw[1], raw[2]];
  };
  const red = pxAt(outRed);
  const blue = pxAt(outBlue);
  assert.notDeepEqual(red, blue, `red render's corner pixel (${red}) must differ from blue's (${blue})`);
  assert.ok(red[0] > 200 && red[2] < 50, `expected a red-dominant pixel, got ${red}`);
  assert.ok(blue[2] > 200 && blue[0] < 50, `expected a blue-dominant pixel, got ${blue}`);

  rmSync(dir, { recursive: true, force: true });
});

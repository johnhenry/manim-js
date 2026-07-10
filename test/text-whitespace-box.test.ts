// Whitespace-only Text in vector mode must occupy its advance width.
// Regression: a vector-mode Text(" ") produced no glyph outlines, so its
// bounding box degenerated to a point at the origin — any nextTo/layout
// chain through a space token (Code's token rows) silently collapsed,
// stacking all subsequent tokens near the origin.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadVectorFont } from "../src/renderer/fonts-node.ts";

const font = await loadVectorFont("sans-serif").catch(() => null);
const skip = !font && "no vector font available";

test("vector Text(' ') has real advance width and doesn't draw", { skip }, async () => {
  const { Text } = await import("../src/mobject/text/Text.ts");
  const space = new Text(" ");
  assert.ok(space.getWidth() > 0.05, `space width ${space.getWidth()}`);
  assert.ok(space.getHeight() > 0.1, `space height ${space.getHeight()}`);
  // Layout-only: the box must never rasterize as a filled path.
  assert.equal(space.fillOpacity, 0);
  assert.equal(space.strokeOpacity, 0);
  // Wider whitespace occupies more room.
  const three = new Text("   ");
  assert.ok(three.getWidth() > space.getWidth() * 2, "three spaces are wider than one");
});

test("nextTo chains through a space token keep flowing rightward", { skip }, async () => {
  const { Text } = await import("../src/mobject/text/Text.ts");
  const V = await import("../src/core/math/vector.ts");
  const a = new Text("function");
  const sp = new Text(" ");
  const b = new Text("fib");
  sp.nextTo(a, V.RIGHT, 0.05);
  b.nextTo(sp, V.RIGHT, 0.05);
  const aRight = a.getBoundingBox().max[0];
  const bLeft = b.getBoundingBox().min[0];
  assert.ok(bLeft > aRight, `"fib" (${bLeft}) must start after "function" ends (${aRight})`);
});

test("Code token rows lay out monotonically (no origin collapse)", { skip }, async () => {
  const { Code } = await import("../src/mobject/text/code.ts");
  const code = new Code("function fib(n) {", { language: "javascript", lineNumbers: false });
  let prevRight = -Infinity;
  for (const tok of code.codeTokens.submobjects) {
    const box = tok.getBoundingBox();
    assert.ok(box.min[0] >= prevRight - 0.06, `token ${JSON.stringify((tok as any).text)} overlaps its predecessor`);
    prevRight = box.max[0];
  }
});

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Square, Circle } from "../src/mobject/geometry.ts";
import { VGroup, VMobject } from "../src/mobject/VMobject.ts";
import { Text } from "../src/mobject/text/Text.ts";
import {
  DrawBorderThenFill,
  Unwrite,
  ShowIncreasingSubsets,
  ShowSubmobjectsOneByOne,
  AddTextLetterByLetter,
  SpiralIn,
} from "../src/animation/creation_extra.ts";

// Load a vector font so `new Text(...)` builds real glyph submobjects.
before(async () => {
  const { loadVectorFont } = await import("../src/renderer/fonts-node.ts");
  await loadVectorFont();
});

// Count how many submobjects in a group are currently visible (opacity > 0).
function visibleCount(group: any): number {
  return group.submobjects.filter((m: any) => (m.opacity ?? 1) > 1e-6).length;
}

function makeGroup(n: number): VGroup {
  const g = new VGroup();
  for (let i = 0; i < n; i++) {
    const c = new Circle({ radius: 0.3 });
    c.moveTo([i, 0, 0]);
    g.add(c);
  }
  return g;
}

test("DrawBorderThenFill: fill≈0 & partial stroke at 0.25, full fill at 1", () => {
  const sq = new Square({ sideLength: 2 });
  sq.setFill("#FF0000", 1);
  const anim = new DrawBorderThenFill(sq);
  anim.begin();
  anim.interpolate(0.25);
  const m = sq.getFamily()[0] as any;
  assert.ok(m.fillOpacity <= 1e-6, `fill should be ~0 during border phase, got ${m.fillOpacity}`);
  assert.ok(m.strokeEnd > 0 && m.strokeEnd < 1, `stroke should be partial, got ${m.strokeEnd}`);
  anim.finish();
  const mf = sq.getFamily()[0] as any;
  assert.ok(Math.abs(mf.fillOpacity - 1) < 1e-6, `fill should be full at end, got ${mf.fillOpacity}`);
  assert.equal(mf.strokeEnd, 1);
});

test("ShowIncreasingSubsets reveals ~2 of 4 at alpha 0.5", () => {
  const g = makeGroup(4);
  const anim = new ShowIncreasingSubsets(g);
  anim.begin();
  anim.interpolate(0.5);
  assert.equal(visibleCount(g), 2, "half of 4 submobjects visible");
  anim.finish();
  assert.equal(visibleCount(g), 4, "all visible after finish");
  assert.equal(anim.introducer, true);
});

test("ShowSubmobjectsOneByOne shows exactly one at a time", () => {
  const g = makeGroup(4);
  const anim = new ShowSubmobjectsOneByOne(g);
  anim.begin();
  anim.interpolate(0.5);
  assert.equal(visibleCount(g), 1, "exactly one submobject visible mid-animation");
  anim.interpolate(0.9);
  assert.equal(visibleCount(g), 1, "still exactly one near the end");
});

test("AddTextLetterByLetter reveals glyphs progressively", () => {
  const t = new Text("abc");
  assert.ok(t.chars.submobjects.length === 3, "vector Text has 3 glyphs");
  const anim = new AddTextLetterByLetter(t);
  anim.begin();
  anim.interpolate(0.3);
  const early = visibleCount(t);
  anim.interpolate(0.9);
  const late = visibleCount(t);
  assert.ok(early < late, `fewer glyphs at 0.3 (${early}) than 0.9 (${late})`);
  assert.equal(anim.introducer, true);
  anim.finish();
  assert.equal(visibleCount(t), 3, "all glyphs visible at end");
});

test("Unwrite is a remover", () => {
  const sq = new Square({ sideLength: 2 });
  const anim = new Unwrite(sq);
  assert.equal(anim.remover, true, "Unwrite should be a remover");
  assert.equal(anim.introducer, false);
});

test("SpiralIn ends with submobjects at full opacity & original positions", () => {
  const g = makeGroup(3);
  // Record original geometry before the animation mutates it.
  const orig = g.getFamily().map((m: any) => m.points.map((p: number[]) => [...p]));
  const anim = new SpiralIn(g);
  anim.begin();
  // Mid-animation the geometry is displaced (spiral) — sanity that it moved.
  anim.interpolate(0.4);
  anim.finish();
  const fam = g.getFamily();
  fam.forEach((m: any, i: number) => {
    // Full stroke opacity restored.
    assert.ok((m.strokeOpacity ?? 0) > 0.9, `stroke opacity restored for member ${i}`);
    for (let j = 0; j < m.points.length; j++) {
      assert.ok(Math.abs(m.points[j][0] - orig[i][j][0]) < 1e-6, "x restored");
      assert.ok(Math.abs(m.points[j][1] - orig[i][j][1]) < 1e-6, "y restored");
    }
  });
  assert.equal(anim.introducer, true);
});

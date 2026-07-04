import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Code } from "../src/mobject/text/code.ts";
import { Transform, FadeIn, FadeOut } from "../src/animation/Animation.ts";

// Code.diffTo(): morphs one Code snapshot into another via
// TransformMatchingAuto over the flat codeTokens group (Code-Surfer-style
// code-diff-morph), reusing that engine as-is rather than building a new one
// -- every token is already a Text mobject keyed by its own literal string.
// The one real gap (autoKey() matches by text content alone, so two
// instances of the same token on one line can't be disambiguated) is closed
// by seeding matchId as "text:line:col" before matching.

before(async () => {
  await (await import("../src/renderer/fonts-node.ts")).loadVectorFont();
});

test("color-only changes produce Transforms, not FadeIn/FadeOut", () => {
  const a = new Code("let x = 1;", { language: "js", lineNumbers: false });
  const b = new Code("let x = 1;", { language: "js", lineNumbers: false, style: { default: "#FFFFFF" } });
  const group = a.diffTo(b);
  assert.ok(group.animations.length > 0);
  for (const anim of group.animations) {
    assert.ok(anim instanceof Transform, `expected only Transforms for an unchanged token sequence, got ${anim.constructor.name}`);
  }
});

test("a duplicated identifier on one line morphs the correct instance, not an arbitrary FIFO pairing", () => {
  // Two "x" tokens on the same line in both versions, but only the SECOND
  // one's neighboring text differs between a and b.
  const a = new Code("x + x", { language: "js", lineNumbers: false });
  const b = new Code("x + y", { language: "js", lineNumbers: false });

  const group = a.diffTo(b);
  const transforms = group.animations.filter((x: any) => x instanceof Transform) as Transform[];

  // Find the Transform whose SOURCE is the first "x" token of `a` (line 0,
  // col 0) via the matchId seeded by diffTo().
  const firstX = a.codeTokens.submobjects.find((m: any) => m.matchId === "x:0:0")!;
  const firstXTransform = transforms.find((t) => t.mobject === firstX)!;
  assert.ok(firstXTransform, "the first 'x' token should have a matched Transform (it's unchanged)");
  assert.equal((firstXTransform.target as any).text, "x", "the first 'x' should pair to the unchanged first 'x' in b, not to y");

  // The second "x" (col 4, after "x + ") has no matching token in b at all
  // (b's line is "x + y") -- it should fade rather than force-pair to "y".
  const secondX = a.codeTokens.submobjects.find((m: any) => m.matchId === "x:0:4")!;
  const secondXTransform = transforms.find((t) => t.mobject === secondX);
  assert.equal(secondXTransform, undefined, "the second 'x' has no counterpart in b and should not be force-paired");
  const fadeOuts = group.animations.filter((x: any) => x instanceof FadeOut);
  assert.ok(fadeOuts.some((f: any) => f.mobject === secondX), "the second 'x' should fade out, not morph into 'y'");
});

test("a line inserted at the top fades unrelated content below it (known, documented limitation)", () => {
  const a = new Code("first\nsecond", { language: "js", lineNumbers: false });
  const b = new Code("inserted\nfirst\nsecond", { language: "js", lineNumbers: false });

  const group = a.diffTo(b);
  const transforms = group.animations.filter((x: any) => x instanceof Transform) as Transform[];
  // Because matchId is position-sensitive (text:line:col), "first" moved
  // from line 0 in `a` to line 1 in `b` -- its key no longer matches, so it
  // must fade rather than morph. This assertion locks in that documented
  // trade-off as expected behavior, not a silent regression.
  const firstTok = a.codeTokens.submobjects.find((m: any) => m.matchId === "first:0:0")!;
  assert.ok(!transforms.some((t) => t.mobject === firstTok), "'first' shifted to a new line/col and should not be treated as unchanged");
  const fadeOuts = group.animations.filter((x: any) => x instanceof FadeOut);
  const fadeIns = group.animations.filter((x: any) => x instanceof FadeIn);
  assert.ok(fadeOuts.some((f: any) => f.mobject === firstTok), "'first' from `a` should fade out");
  assert.ok(fadeIns.length > 0, "the shifted 'first' (and the new 'inserted' line) in `b` should fade in");
});

test("diffTo includes a Transform for the background rectangle", () => {
  const a = new Code("x", { language: "js", lineNumbers: false });
  const b = new Code("a much longer line of code here", { language: "js", lineNumbers: false });
  const group = a.diffTo(b);
  const bgTransform = group.animations.find((x: any) => x instanceof Transform && x.mobject === a.background);
  assert.ok(bgTransform, "the background rectangle should get its own resize Transform");
  assert.equal((bgTransform as any).target, b.background);
});

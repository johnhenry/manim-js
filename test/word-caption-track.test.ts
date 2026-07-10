// WordCaptionTrack: per-token karaoke styling driven purely by the caption
// clock — mid-token states, page transitions, backward seeks, wrapping.

import { test } from "node:test";
import assert from "node:assert/strict";
import { WordCaptionTrack } from "../src/captions/caption_track.ts";
import { createTikTokStyleCaptions } from "../src/captions/captions.ts";
import type { Caption, CaptionPage } from "../src/captions/captions.ts";
import { Color } from "../src/core/color.ts";

const cap = (text: string, startMs: number, endMs: number): Caption => ({
  text, startMs, endMs, timestampMs: startMs, confidence: null,
});

// Two pages: "Hello brave world" (0-900ms) and "Goodbye now" (2000-2600ms).
const PAGES: CaptionPage[] = createTikTokStyleCaptions({
  captions: [
    cap("Hello", 0, 300), cap(" brave", 300, 600), cap(" world", 600, 900),
    cap("Goodbye", 2000, 2300), cap(" now", 2300, 2600),
  ],
  combineTokensWithinMilliseconds: 500,
}).pages;

const hex = (c: Color): string => c.toHex().toLowerCase();

test("mid-token: active word is highlighted+popped, past is base, future is dimmed", () => {
  const track = new WordCaptionTrack(PAGES, {
    color: "#ffffff",
    highlight: { color: "#ffe066", scale: 1.2, popMs: 120, futureOpacity: 0.4 },
  });
  track.seekMs(450); // inside " brave"
  assert.equal(track.currentPageIndex, 0);
  const [hello, brave, world] = track.tokenTexts;
  assert.equal(hex(hello.fillColor), "#ffffff");
  assert.equal(hello.fillOpacity, 1);
  assert.equal(hex(brave.fillColor), "#ffe066");
  assert.equal(brave.fillOpacity, 1);
  assert.equal(hex(world.fillColor), "#ffffff");
  assert.equal(world.fillOpacity, 0.4);
  // 150ms into the token > popMs → pop settled: active box is 1.2x wider
  // than an equal-length past token's box... compare against its own future
  // width instead (same token, pre-activation).
  const activeW = brave.getWidth();
  track.seekMs(250); // brave not yet active
  const futureW = track.tokenTexts[1].getWidth();
  assert.ok(Math.abs(activeW / futureW - 1.2) < 1e-9, `expected 1.2x pop, got ${activeW / futureW}`);
});

test("pop-in ramps over popMs (mid-pop scale strictly between 1 and full)", () => {
  const track = new WordCaptionTrack(PAGES, { highlight: { scale: 1.2, popMs: 120 } });
  track.seekMs(0); // "Hello" just became active
  const w0 = track.tokenTexts[0].getWidth();
  track.seekMs(60); // mid-pop
  const wMid = track.tokenTexts[0].getWidth();
  track.seekMs(200); // settled
  const wFull = track.tokenTexts[0].getWidth();
  assert.ok(wMid > w0 && wMid < wFull, `expected ${w0} < ${wMid} < ${wFull}`);
});

test("page transitions swap the token set; between pages nothing is shown", () => {
  const track = new WordCaptionTrack(PAGES, {});
  track.seekMs(100);
  assert.equal(track.currentPageIndex, 0);
  assert.deepEqual(track.tokenTexts.map((t) => t.text), ["Hello", "brave", "world"]);
  track.seekMs(1500); // gap between pages
  assert.equal(track.currentPageIndex, -1);
  assert.equal(track.tokenTexts.length, 0);
  assert.equal(track.submobjects.length, 0);
  track.seekMs(2100);
  assert.equal(track.currentPageIndex, 1);
  assert.deepEqual(track.tokenTexts.map((t) => t.text), ["Goodbye", "now"]);
});

test("backward seek lands on the identical frame (stateless layout + styling)", () => {
  const a = new WordCaptionTrack(PAGES, {});
  const b = new WordCaptionTrack(PAGES, {});
  a.seekMs(450);
  const snapshot = a.tokenTexts.map((t) => ({
    text: t.text, color: hex(t.fillColor), opacity: t.fillOpacity, points: JSON.stringify(t.points),
  }));
  // b wanders forward past page 2, then seeks BACK to 450.
  b.seekMs(2100);
  b.seekMs(450);
  const back = b.tokenTexts.map((t) => ({
    text: t.text, color: hex(t.fillColor), opacity: t.fillOpacity, points: JSON.stringify(t.points),
  }));
  assert.deepEqual(back, snapshot);
});

test("maxWidth wraps tokens onto multiple lines; without it one line", () => {
  const wide = new WordCaptionTrack(PAGES, { fontSize: 0.5 });
  wide.seekMs(100);
  const ys = new Set(wide.tokenTexts.map((t) => t.getCenter()[1].toFixed(6)));
  assert.equal(ys.size, 1, "no maxWidth → single line");
  const narrow = new WordCaptionTrack(PAGES, { fontSize: 0.5, maxWidth: 1.5 });
  narrow.seekMs(100);
  const ys2 = new Set(narrow.tokenTexts.map((t) => t.getCenter()[1].toFixed(6)));
  assert.ok(ys2.size >= 2, "narrow maxWidth → wrapped lines");
  // Wrap uses UNSCALED widths (the active pop may exceed maxWidth briefly) —
  // check the non-active tokens stay within it.
  for (const t of narrow.tokenTexts.slice(1)) assert.ok(t.getWidth() <= 1.5 + 1e-9);
});

test("updater dt accumulation matches seekMs (play-path parity)", () => {
  const viaUpdater = new WordCaptionTrack(PAGES, {});
  // Simulate the scene loop: 30 ticks of dt=0.015s → 450ms.
  for (let i = 0; i < 30; i++) viaUpdater.update(0.015);
  const viaSeek = new WordCaptionTrack(PAGES, {});
  viaSeek.seekMs(450);
  assert.deepEqual(
    viaUpdater.tokenTexts.map((t) => hex(t.fillColor)),
    viaSeek.tokenTexts.map((t) => hex(t.fillColor)),
  );
});

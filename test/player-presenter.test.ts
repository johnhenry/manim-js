import { test } from "node:test";
import assert from "node:assert/strict";
import { Player } from "../src/player.ts";

// Build a headless Player with fake frames + scene sections (no rendering needed).
function fakePlayer() {
  const p: any = new Player({ fps: 10 });
  p.frames = new Array(30).fill({ width: 1, height: 1 });
  p.scene = { sections: [
    { name: "intro", startFrame: 0, endFrame: 10, type: "section.normal" },
    { name: "loop", startFrame: 10, endFrame: 20, type: "section.loop" },
    { name: "outro", startFrame: 20, endFrame: 30, type: "section.normal" },
  ] };
  return p;
}

test("playbackRate + volume setters clamp", () => {
  const p: any = new Player({ fps: 10 });
  p.setPlaybackRate(2); assert.equal(p.playbackRate, 2);
  p.setPlaybackRate(0); assert.ok(p.playbackRate > 0);
  p.setVolume(2); assert.equal(p.volume, 1);
  p.setVolume(-1); assert.equal(p.volume, 0);
});

test("sectionContaining + seekToSection", () => {
  const p = fakePlayer();
  assert.equal(p.sectionContaining(5).name, "intro");
  assert.equal(p.sectionContaining(15).name, "loop");
  assert.equal(p.sectionContaining(25).name, "outro");
  p.seekToSection("loop");
  assert.equal(p.currentFrame, 10);
  p.seekToSection(2);
  assert.equal(p.currentFrame, 20);
});

test("nextSection / prevSection navigate boundaries", () => {
  const p = fakePlayer();
  p.seek(0);
  p.nextSection(); assert.equal(p.currentFrame, 10);
  p.nextSection(); assert.equal(p.currentFrame, 20);
  p.prevSection(); assert.equal(p.currentFrame, 10);
});

test("sections() empty when no scene", () => {
  const p: any = new Player({ fps: 10 });
  assert.deepEqual(p.sections(), []);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { parseBookmarks, voiceover } from "../src/voiceover/voiceover.ts";
import {
  registerTTSProvider, listTTSProviders, resolveTTSProvider, silentProvider,
} from "../src/voiceover/providers.ts";
import { Scene } from "../src/scene/Scene.ts";

function ffmpegAvailable() {
  try { execSync("ffmpeg -version", { stdio: "ignore" }); return true; } catch { return false; }
}

// A deterministic fake provider (no network / binaries) for orchestration tests.
registerTTSProvider({
  name: "fake",
  available: () => true,
  async synthesize(_text: string) {
    return { file: "/tmp/_mjs_fake_voice.wav", durationSeconds: 2.0 };
  },
});

function freshScene() {
  const s = new Scene({ fps: 30 });
  s.frameHandler = async () => {}; // no renderer needed
  return s;
}

test("parseBookmarks strips tags and records char positions", () => {
  const { clean, bookmarks } = parseBookmarks("First <bookmark mark='a'/> then <bookmark mark=\"b\"/> end.");
  assert.equal(clean, "First  then  end.");
  assert.equal(bookmarks.length, 2);
  assert.equal(bookmarks[0].name, "a");
  assert.equal(bookmarks[1].name, "b");
  assert.ok(bookmarks[0].charIndex < bookmarks[1].charIndex);
});

test("built-in providers are registered; silent is always available", async () => {
  const names = listTTSProviders();
  for (const n of ["silent", "system", "openai", "elevenlabs"]) assert.ok(names.includes(n));
  assert.equal(await silentProvider.available(), true);
  // With no keys/binaries preferred, resolves to silent.
  const p = await resolveTTSProvider("nonexistent");
  assert.ok(["silent", "system"].includes(p.name));
});

test("voiceover adds a sound, exposes duration, and advances scene time to the end", async () => {
  const scene = freshScene();
  let seenDuration = 0;
  const tracker = await voiceover(scene, "hello world", async (vt) => {
    seenDuration = vt.duration;
  }, { provider: "fake" });
  assert.equal(tracker.duration, 2.0);
  assert.equal(seenDuration, 2.0);
  assert.equal(scene.sounds.length, 1);
  assert.equal(scene.sounds[0].time, 0);
  // After the callback, remaining audio is waited out → time ~ duration.
  assert.ok(Math.abs(scene.time - 2.0) < 0.05, `scene.time=${scene.time}`);
});

test("waitUntilBookmark advances to the bookmark time (proportional without word timings)", async () => {
  const scene = freshScene();
  // "AAAA <bookmark/> BBBB" — bookmark ~ middle of the clean text.
  await voiceover(scene, "aaaa <bookmark mark='mid'/> bbbb", async (vt) => {
    assert.ok(Math.abs(scene.time - 0) < 0.05, "starts at 0");
    await vt.waitUntilBookmark("mid");
    const expected = vt.timeAtBookmark("mid");
    assert.ok(Math.abs(scene.time - expected) < 0.1, `at bookmark: ${scene.time} vs ${expected}`);
    assert.ok(expected > 0.5 && expected < 1.6, `mid bookmark ~1s of 2s clip: ${expected}`);
  }, { provider: "fake" });
});

test("silent provider synthesizes a real clip (skips without ffmpeg)", { skip: !ffmpegAvailable() }, async () => {
  const r = await silentProvider.synthesize("one two three four five");
  const { existsSync, statSync } = await import("node:fs");
  assert.ok(existsSync(r.file));
  assert.ok(statSync(r.file).size > 0);
  assert.ok(r.durationSeconds > 1 && r.durationSeconds < 5, `est duration ${r.durationSeconds}`);
});

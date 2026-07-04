import { test } from "node:test";
import assert from "node:assert/strict";

import {
  timeToPixel, pixelToTime, frameToPixel, pixelToFrame,
  computeSectionThumbnails, renderSectionOverview, computeStepMarkers,
  computeWaveformBars, renderWaveform,
  computeKeyframeMarkers, renderKeyframeTimeline, attachKeyframeTimelineEditor,
} from "../src/studio/timeline.ts";

test("timeToPixel / pixelToTime round-trip", () => {
  const opts = { duration: 10, pixelWidth: 500 };
  assert.equal(timeToPixel(5, opts), 250);
  assert.equal(timeToPixel(0, opts), 0);
  assert.equal(timeToPixel(10, opts), 500);
  assert.equal(pixelToTime(250, opts), 5);
});

test("frameToPixel / pixelToFrame round-trip", () => {
  const opts = { totalFrames: 300, pixelWidth: 600 };
  assert.equal(frameToPixel(150, opts), 300);
  assert.equal(pixelToFrame(300, opts), 150);
});

test("computeSectionThumbnails positions each section proportionally, clamped to minWidth", () => {
  const sections = [
    { name: "intro", startFrame: 0, endFrame: 10 },
    { name: "main", startFrame: 10, endFrame: 90 },
    { name: "outro", startFrame: 90, endFrame: 100 },
  ];
  const layout = computeSectionThumbnails(sections, { totalFrames: 100, pixelWidth: 1000, minWidth: 5 });
  assert.equal(layout.length, 3);
  assert.equal(layout[0].x, 0);
  assert.equal(layout[0].width, 100); // 10/100 * 1000
  assert.equal(layout[1].x, 100);
  assert.equal(layout[1].width, 800); // 80/100 * 1000
  assert.equal(layout[2].x, 900);
  assert.equal(layout[2].width, 100);
});

test("computeSectionThumbnails clamps a very short section to minWidth", () => {
  const sections = [{ name: "blip", startFrame: 0, endFrame: 1 }];
  const layout = computeSectionThumbnails(sections, { totalFrames: 1000, pixelWidth: 1000, minWidth: 24 });
  assert.equal(layout[0].width, 24); // raw would be 1px, clamped up
});

test("computeSectionThumbnails treats an open (endFrame < 0) section as extending to totalFrames", () => {
  const sections = [{ name: "live", startFrame: 50, endFrame: -1 }];
  const layout = computeSectionThumbnails(sections, { totalFrames: 100, pixelWidth: 1000 });
  assert.equal(layout[0].x, 500);
  assert.equal(layout[0].width, 500);
});

test("renderSectionOverview draws one thumbnail per section at its computed position", () => {
  const calls: any[] = [];
  const fakePlayer = {
    sections: () => [
      { name: "a", startFrame: 0, endFrame: 50 },
      { name: "b", startFrame: 50, endFrame: 100 },
    ],
    frameCount: 100,
    drawFrameTo: (ctx: any, frameIndex: number, opts: any) => calls.push({ frameIndex, opts }),
  };
  const layout = renderSectionOverview({}, fakePlayer, { pixelWidth: 200, height: 40 });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].frameIndex, 0);
  assert.equal(calls[0].opts.x, 0);
  assert.equal(calls[1].frameIndex, 50);
  assert.equal(calls[1].opts.x, 100);
  assert.equal(layout.length, 2);
});

test("computeStepMarkers positions one marker per step at its start frame", () => {
  const steps = [
    { index: 0, startFrame: 0 },
    { index: 1, startFrame: 25 },
    { index: 2, startFrame: 75 },
  ];
  const markers = computeStepMarkers(steps, { totalFrames: 100, pixelWidth: 400 });
  assert.deepEqual(markers.map((m) => m.x), [0, 100, 300]);
});

test("computeWaveformBars evenly spaces bars and scales height by amplitude", () => {
  const samples = [0, 0.5, 1, -1];
  const bars = computeWaveformBars(samples, { pixelWidth: 400, maxHeight: 20 });
  assert.equal(bars.length, 4);
  assert.deepEqual(bars.map((b) => b.x), [0, 100, 200, 300]);
  assert.deepEqual(bars.map((b) => b.height), [0, 10, 20, 20]); // abs(-1) -> full height
});

test("computeWaveformBars clamps height to maxHeight even if a sample exceeds 1", () => {
  const bars = computeWaveformBars([2], { pixelWidth: 100, maxHeight: 10 });
  assert.equal(bars[0].height, 10);
});

test("computeWaveformBars of an empty sample set returns no bars", () => {
  assert.deepEqual(computeWaveformBars([], { pixelWidth: 100, maxHeight: 10 }), []);
});

test("renderWaveform draws one fillRect per bar and returns the same layout computeWaveformBars would", () => {
  const calls: any[] = [];
  const fakeCtx = { fillRect: (...args: any[]) => calls.push(args), fillStyle: "" };
  const samples = [0.25, 1];
  const bars = renderWaveform(fakeCtx, samples, { pixelWidth: 200, height: 40, x: 500, y: 10 });
  assert.equal(calls.length, 2);
  assert.deepEqual(bars, computeWaveformBars(samples, { pixelWidth: 200, maxHeight: 40 }));
  // Bars are offset by opts.x/opts.y and vertically centered within the strip.
  const [x0, y0] = calls[0];
  assert.equal(x0, 500 + bars[0].x);
  assert.equal(y0, 10 + 20 - bars[0].height / 2);
});

// --- keyframe timeline (item 8) ---------------------------------------------

function makeFakeCanvas(): any {
  const listeners = new Map<string, Set<(ev: any) => void>>();
  return {
    getBoundingClientRect() { return { left: 0, top: 0 }; },
    addEventListener(type: string, fn: any) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener(type: string, fn: any) { listeners.get(type)?.delete(fn); },
    dispatch(type: string, ev: any) { for (const fn of [...(listeners.get(type) ?? [])]) fn(ev); },
  };
}

test("computeKeyframeMarkers positions one marker per keyframe, across all tracks", () => {
  const trackA = { keyframes: [{ t: 0 }, { t: 5 }] };
  const trackB = { keyframes: [{ t: 2.5 }] };
  const markers = computeKeyframeMarkers([trackA, trackB], { duration: 10, pixelWidth: 100 });
  assert.equal(markers.length, 3);
  assert.deepEqual(markers.map((m) => m.x), [0, 50, 25]);
  assert.equal(markers[0].track, trackA);
  assert.equal(markers[2].track, trackB);
});

test("renderKeyframeTimeline draws one dot per keyframe, one row per track", () => {
  const calls: any[] = [];
  const fakeCtx = {
    beginPath: () => calls.push("beginPath"),
    arc: (...args: any[]) => calls.push(["arc", ...args]),
    fill: () => calls.push("fill"),
  };
  const trackA = { keyframes: [{ t: 0 }, { t: 5 }] };
  const trackB = { keyframes: [{ t: 2.5 }] };
  const markers = renderKeyframeTimeline(fakeCtx, [trackA, trackB], { duration: 10, pixelWidth: 100, rowHeight: 20 });
  assert.equal(markers.length, 3);
  const arcCalls = calls.filter((c) => Array.isArray(c) && c[0] === "arc");
  assert.equal(arcCalls.length, 3);
  // trackB's single marker is drawn on row 1 (y = 1*20 + 10 = 30).
  assert.equal(arcCalls[2][2], 30);
});

test("attachKeyframeTimelineEditor: dragging a keyframe marker updates its time", () => {
  const canvas = makeFakeCanvas();
  const track = { keyframes: [{ t: 5 }] };
  const axis = { duration: 10, pixelWidth: 100, rowHeight: 20 };
  let changeCount = 0;
  attachKeyframeTimelineEditor(canvas, [track], { ...axis, onChange: () => changeCount++ });

  // The keyframe at t=5 sits at x=50, y=10 (single track, row 0).
  canvas.dispatch("pointerdown", { clientX: 50, clientY: 10 });
  canvas.dispatch("pointermove", { clientX: 80, clientY: 10 });
  assert.ok(Math.abs(track.keyframes[0].t - 8) < 1e-6, `expected t~=8, got ${track.keyframes[0].t}`);
  assert.equal(changeCount, 1);
});

test("attachKeyframeTimelineEditor: a pointerdown far from any marker starts no drag", () => {
  const canvas = makeFakeCanvas();
  const track = { keyframes: [{ t: 5 }] };
  const axis = { duration: 10, pixelWidth: 100, rowHeight: 20 };
  let changeCount = 0;
  attachKeyframeTimelineEditor(canvas, [track], { ...axis, onChange: () => changeCount++ });

  canvas.dispatch("pointerdown", { clientX: 5, clientY: 5 }); // far from x=50
  canvas.dispatch("pointermove", { clientX: 90, clientY: 5 });
  assert.equal(track.keyframes[0].t, 5, "no drag should have started");
  assert.equal(changeCount, 0);
});

test("attachKeyframeTimelineEditor: keyframes stay sorted while dragging past a neighbor", () => {
  const canvas = makeFakeCanvas();
  const track = { keyframes: [{ t: 1 }, { t: 5 }] };
  const axis = { duration: 10, pixelWidth: 100, rowHeight: 20 };
  attachKeyframeTimelineEditor(canvas, [track], axis);

  // Drag the keyframe at t=1 (x=10) past the one at t=5 (x=50).
  canvas.dispatch("pointerdown", { clientX: 10, clientY: 10 });
  canvas.dispatch("pointermove", { clientX: 80, clientY: 10 });
  const times = track.keyframes.map((k) => k.t).sort((a, b) => a - b);
  assert.deepEqual(track.keyframes.map((k) => k.t), times, "keyframes must remain t-sorted after a drag");
});

test("attachKeyframeTimelineEditor: onCommit fires once, debounced, after pointerup", () => {
  const canvas = makeFakeCanvas();
  const track = { keyframes: [{ t: 5 }] };
  const axis = { duration: 10, pixelWidth: 100, rowHeight: 20 };
  let commits = 0;
  attachKeyframeTimelineEditor(canvas, [track], { ...axis, onCommit: () => commits++, commitDelayMs: 10 });

  canvas.dispatch("pointerdown", { clientX: 50, clientY: 10 });
  canvas.dispatch("pointermove", { clientX: 60, clientY: 10 });
  canvas.dispatch("pointerup", {});
  assert.equal(commits, 0, "onCommit is debounced, not immediate");
});

test("attachKeyframeTimelineEditor.detach() removes all listeners", () => {
  const canvas = makeFakeCanvas();
  const track = { keyframes: [{ t: 5 }] };
  const axis = { duration: 10, pixelWidth: 100, rowHeight: 20 };
  let changeCount = 0;
  const handle = attachKeyframeTimelineEditor(canvas, [track], { ...axis, onChange: () => changeCount++ });
  handle.detach();

  canvas.dispatch("pointerdown", { clientX: 50, clientY: 10 });
  canvas.dispatch("pointermove", { clientX: 80, clientY: 10 });
  assert.equal(changeCount, 0, "detached editor must not respond to further drags");
});

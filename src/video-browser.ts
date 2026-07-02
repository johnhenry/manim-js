// Browser frame providers + a loadVideo() factory for VideoMobject.
//
// This is the browser-oriented counterpart to the Node ffmpeg-backed provider.
// It must remain IMPORT-SAFE under plain Node (no DOM): the classes are defined
// unconditionally, but NOTHING at module top-level touches `document`,
// `HTMLVideoElement`, `Image`, `createImageBitmap`, or WebCodecs. Those are only
// referenced inside methods / the async factory, guarded by runtime checks, so
// simply `import`ing this module in Node never throws. Real browser behavior is
// exercised by the orchestrator under the GPU lock; our Node tests use fakes.
//
// Two providers implement the isomorphic VideoFrameProvider contract:
//   - LiveVideoProvider   — low-latency real-time playback. frameAt(t) nudges
//                           video.currentTime and returns the <video> element as
//                           the drawable (not frame-accurate).
//   - PreCapturedProvider — frame-accurate, dependency-free. Pre-captures every
//                           frame up front (seek-and-draw), so frameAt(t) is a
//                           cheap synchronous array lookup — exactly what the
//                           per-frame updater in VideoMobject needs.

import { VideoMobject } from "./mobject/video_mobject.ts";
import type { VideoFrameProvider, VideoMobjectConfig } from "./mobject/video_mobject.ts";

/** True only when a DOM is present. Never dereferences DOM types at import. */
const hasDOM = typeof document !== "undefined";

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}

// ---------------------------------------------------------------------------
// LiveVideoProvider
// ---------------------------------------------------------------------------
// Wraps a ready <video> element (metadata already loaded). For real-time play(),
// frameAt(t) does a best-effort seek (sets currentTime) and returns the element
// itself as the drawable — the renderer draws whatever the element is currently
// showing. This is intentionally NOT frame-accurate: it trades determinism for
// low latency, which is the right call for live on-screen playback.
export class LiveVideoProvider implements VideoFrameProvider {
  readonly fps: number;
  private video: any;

  constructor(video: any, fps: number = 30) {
    this.video = video;
    this.fps = fps;
  }

  get duration(): number {
    const d = this.video?.duration;
    return Number.isFinite(d) ? d : 0;
  }
  get width(): number {
    return this.video?.videoWidth ?? 0;
  }
  get height(): number {
    return this.video?.videoHeight ?? 0;
  }

  frameAt(timeSeconds: number): any {
    const v = this.video;
    if (!v) return null;
    const t = clamp(timeSeconds, 0, this.duration || 0);
    // Best-effort nudge. The decode is async in the element; we don't await it,
    // so what actually gets drawn is "close enough" to t for live playback.
    try {
      if (Math.abs((v.currentTime ?? 0) - t) > 1e-3) v.currentTime = t;
    } catch {
      /* seeking may be rejected mid-load; ignore */
    }
    return v;
  }

  dispose(): void {
    try {
      this.video?.pause?.();
    } catch {
      /* ignore */
    }
    this.video = null;
  }
}

// ---------------------------------------------------------------------------
// PreCapturedProvider
// ---------------------------------------------------------------------------
// Frame-accurate and dependency-free. In init(), it walks the clip one frame at
// a time (t = i / fps), seeks the <video> to each target time, awaits the
// `seeked` event, and draws the frame into an offscreen canvas which is then
// snapshotted to an ImageBitmap (or the canvas itself as a fallback). The result
// is a flat array of drawables. frameAt(t) is then a pure synchronous lookup:
//   frames[clamp(round(t * fps), 0, n - 1)]
//
// NOTE ON WEBCODECS: A WebCodecs `VideoDecoder` path would be faster and more
// accurate, but decoding an .mp4/.webm requires demuxing the container, which
// needs a demuxer library (e.g. mp4box.js). To stay dependency-free we DEFAULT
// to seek-and-capture. A WebCodecs + demuxer path is a future accuracy/perf
// upgrade and can be slotted in behind this same synchronous frameAt() contract.
export class PreCapturedProvider implements VideoFrameProvider {
  readonly fps: number;
  private _duration: number;
  private _width: number;
  private _height: number;
  private frames: any[];
  private video: any;

  // The constructor is also the TEST SEAM: pass injected `frames` (+ dims) to
  // build an instance with pre-populated frames and NO real <video>, so the
  // time -> index math can be unit-tested under Node without a browser. When a
  // real <video> is provided, call init() to actually capture the frames.
  constructor(opts: {
    video?: any;
    fps?: number;
    frames?: any[];
    duration?: number;
    width?: number;
    height?: number;
  } = {}) {
    this.video = opts.video ?? null;
    this.fps = opts.fps ?? 30;
    this.frames = opts.frames ? opts.frames.slice() : [];
    // Derive metadata from injected values, else from the element (if present).
    this._width = opts.width ?? this.video?.videoWidth ?? 0;
    this._height = opts.height ?? this.video?.videoHeight ?? 0;
    this._duration =
      opts.duration ??
      (Number.isFinite(this.video?.duration) ? this.video.duration : 0) ??
      0;
    // If frames were injected but no explicit duration, derive it from count.
    if (opts.frames && opts.duration == null && this.fps > 0) {
      this._duration = this.frames.length / this.fps;
    }
  }

  get duration(): number {
    return this._duration;
  }
  get width(): number {
    return this._width;
  }
  get height(): number {
    return this._height;
  }

  /** Number of captured frames (test/introspection helper). */
  get frameCount(): number {
    return this.frames.length;
  }

  // Capture every frame of the clip. Browser-only (needs a DOM + a real
  // <video>). Idempotent-ish: re-running re-captures from scratch.
  async init(): Promise<this> {
    if (!hasDOM) {
      throw new Error(
        "PreCapturedProvider.init() is browser-only: no document available (run under a browser / the GPU-locked orchestrator)",
      );
    }
    const v = this.video;
    if (!v) {
      throw new Error("PreCapturedProvider.init() requires a <video> element");
    }

    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    this._duration = duration;
    this._width = v.videoWidth ?? 0;
    this._height = v.videoHeight ?? 0;

    const w = this._width;
    const h = this._height;
    if (!w || !h) {
      throw new Error("PreCapturedProvider.init(): video has no intrinsic dimensions (metadata not loaded?)");
    }

    // Offscreen drawing surface: prefer OffscreenCanvas, fall back to a DOM
    // <canvas>. Both expose a 2D context and are drawImage-able.
    const canvas: any =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(w, h)
        : document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    const total = Math.max(1, Math.round(duration * this.fps));
    const frames: any[] = [];
    for (let i = 0; i < total; i++) {
      const t = Math.min(i / this.fps, Math.max(0, duration - 1e-4));
      await seekTo(v, t);
      ctx.drawImage(v, 0, 0, w, h);
      frames.push(await snapshot(canvas, ctx, w, h));
    }
    this.frames = frames;
    return this;
  }

  frameAt(timeSeconds: number): any {
    const n = this.frames.length;
    if (n === 0) return null;
    const t = clamp(timeSeconds, 0, this._duration || 0);
    const idx = clamp(Math.round(t * this.fps), 0, n - 1);
    return this.frames[idx];
  }

  dispose(): void {
    for (const f of this.frames) {
      try {
        f?.close?.(); // ImageBitmap.close() frees GPU memory when available
      } catch {
        /* ignore */
      }
    }
    this.frames = [];
    try {
      this.video?.pause?.();
    } catch {
      /* ignore */
    }
    this.video = null;
  }
}

// Seek a <video> to `t` and resolve once the `seeked` event fires. Resolves
// immediately if the element is already at (near) that time.
function seekTo(video: any, t: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (Math.abs((video.currentTime ?? 0) - t) < 1e-4 && video.readyState >= 2) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = t;
    } catch {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    }
  });
}

// Snapshot the drawn canvas into a stable drawable. Prefer createImageBitmap
// (an immutable, cheap-to-draw bitmap). Fall back to cloning the canvas pixels
// so later frames don't overwrite this one.
async function snapshot(canvas: any, ctx: any, w: number, h: number): Promise<any> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(canvas);
    } catch {
      /* fall through to canvas clone */
    }
  }
  // Fallback: copy pixels into a fresh canvas so the frame is retained.
  const out: any =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d").drawImage(canvas, 0, 0);
  return out;
}

// ---------------------------------------------------------------------------
// loadVideo() factory
// ---------------------------------------------------------------------------
export interface LoadVideoBrowserOptions extends VideoMobjectConfig {
  /** Capture / index framerate (default 30). */
  fps?: number;
  /** "precapture" (default) = frame-accurate; "live" = real-time <video>. */
  mode?: "live" | "precapture";
  /** crossOrigin attribute for the created <video> (default "anonymous"). */
  crossOrigin?: string;
}

// Create a VideoMobject in the browser. For a URL string, a <video> element is
// created, configured, and its metadata awaited. `mode` picks the provider:
//   - "precapture" (default): frame-accurate; init() captures all frames up
//     front so record()/play() are deterministic.
//   - "live": low-latency real-time playback via the <video> element itself.
export async function loadVideo(
  src: string | any,
  options: LoadVideoBrowserOptions = {},
): Promise<VideoMobject> {
  if (!hasDOM) {
    throw new Error(
      "loadVideo() is browser-only: no document available. Use the Node backend's loadVideo (ffmpeg) under Node, or run this under a browser.",
    );
  }

  const fps = options.fps ?? 30;
  const mode = options.mode ?? "precapture";
  const video = await normalizeVideo(src, options.crossOrigin ?? "anonymous");

  let provider: VideoFrameProvider;
  if (mode === "live") {
    provider = new LiveVideoProvider(video, fps);
  } else {
    const pre = new PreCapturedProvider({ video, fps });
    await pre.init();
    provider = pre;
  }

  return new VideoMobject(provider, options);
}

// Turn `src` into a ready <video> (metadata loaded). Accepts an existing
// HTMLVideoElement (used as-is, only awaiting metadata if not yet ready) or a
// URL string (a fresh element is created and configured).
async function normalizeVideo(src: string | any, crossOrigin: string): Promise<any> {
  let video: any;
  const isElement =
    typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement;

  if (isElement) {
    video = src;
  } else if (typeof src === "string") {
    video = document.createElement("video");
    video.crossOrigin = crossOrigin;
    video.src = src;
  } else {
    // Duck-typed element (e.g. a test double that isn't a real HTMLVideoElement).
    video = src;
  }

  video.muted = true;
  video.playsInline = true;
  // Load enough to know duration/dimensions and to allow seeking.
  video.preload = "auto";

  await waitForMetadata(video);
  return video;
}

// Resolve once the element's metadata (duration + dimensions) is available.
function waitForMetadata(video: any): Promise<void> {
  const ready = () =>
    video.readyState >= 1 && Number.isFinite(video.duration) && video.videoWidth > 0;
  return new Promise<void>((resolve, reject) => {
    if (ready()) {
      resolve();
      return;
    }
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("loadVideo(): failed to load video metadata"));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
    // Nudge the load if the element hasn't started.
    try {
      video.load?.();
    } catch {
      /* ignore */
    }
  });
}

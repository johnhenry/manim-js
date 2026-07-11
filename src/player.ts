// A frame-recording Player for scrubbable, random-access playback of a Scene.
//
// Unlike the live browser backend (browser.ts), which renders a Scene in real
// time, the Player RECORDS every emitted frame into an in-memory array so the
// UI can seek to any frame instantly (a timeline scrubber) and replay the clip
// decoupled from how long it took to compute.
//
// It is browser-oriented — it renders to an offscreen canvas, snapshots frames
// as ImageBitmap (or ImageData), draws to a display <canvas>, and plays back via
// requestAnimationFrame. But it is written defensively so it also imports and
// (partially) runs in Node: the recording step falls back to @napi-rs/canvas +
// raw pixel buffers when browser globals are missing, and playback becomes a
// no-op. `any` is used freely for the host canvas APIs.

import { Camera, CanvasRenderer } from "./renderer/CanvasRenderer.ts";
import { Scene } from "./scene/Scene.ts";
import { makeScene, runConstruct } from "./scene/orchestrate.ts";

// Quality presets (kept local so this module has no dependency on index.ts,
// which pulls in the full library graph — the Player is meant to be small and
// embeddable).
const QUALITIES: Record<string, { pixelWidth: number; pixelHeight: number; fps: number }> = {
  low: { pixelWidth: 854, pixelHeight: 480, fps: 15 },
  medium: { pixelWidth: 1280, pixelHeight: 720, fps: 30 },
  high: { pixelWidth: 1920, pixelHeight: 1080, fps: 60 },
  fourk: { pixelWidth: 3840, pixelHeight: 2160, fps: 60 },
};

/** A single recorded frame. Exactly one of these payload fields is populated. */
export interface RecordedFrame {
  /** Browser fast-path: a decoded bitmap ready to drawImage(). */
  bitmap?: any; // ImageBitmap
  /** Fallback: raw pixel data (browser ImageData, or a Node substitute). */
  imageData?: any;
  /** Node fallback: the raw RGBA buffer + dims when no ImageData exists. */
  buffer?: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

export interface PlayerOptions {
  /** Display canvas the Player draws recorded frames onto (browser). Optional. */
  canvas?: any;
  /** Camera config (merged into the recording Camera). */
  camera?: any;
  /** Background color for the recording. */
  background?: string;
  /** Quality preset name: low | medium | high | fourk. */
  quality?: string;
  pixelWidth?: number;
  pixelHeight?: number;
  fps?: number;
}

// --- Small host-capability probes (browser vs Node) ---------------------------
const G: any = globalThis as any;
const hasDocument = typeof G.document !== "undefined";
const hasCreateImageBitmap = typeof G.createImageBitmap === "function";
const hasRAF = typeof G.requestAnimationFrame === "function";
const hasOffscreen = typeof G.OffscreenCanvas === "function";

/** Create an offscreen 2D drawing surface, in the browser or Node. */
async function makeOffscreen(width: number, height: number): Promise<{ canvas: any; ctx: any; kind: string }> {
  if (hasOffscreen) {
    const canvas = new G.OffscreenCanvas(width, height);
    return { canvas, ctx: canvas.getContext("2d"), kind: "offscreen" };
  }
  if (hasDocument) {
    const canvas = G.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d"), kind: "dom" };
  }
  // Node fallback: @napi-rs/canvas (an optionalDependency of this package).
  try {
    const mod: any = await import("@napi-rs/canvas");
    const canvas = mod.createCanvas(width, height);
    return { canvas, ctx: canvas.getContext("2d"), kind: "napi" };
  } catch {
    throw new Error(
      "Player.record(): no canvas backend available. In the browser this needs " +
      "OffscreenCanvas or a <canvas>; in Node install @napi-rs/canvas.",
    );
  }
}

/** Snapshot the current contents of an offscreen surface into a RecordedFrame. */
async function snapshot(canvas: any, ctx: any, width: number, height: number): Promise<RecordedFrame> {
  // Fast path: a decoded bitmap the display canvas can blit directly.
  if (hasCreateImageBitmap) {
    try {
      const bitmap = await G.createImageBitmap(canvas);
      return { bitmap, width, height };
    } catch { /* fall through to pixel snapshots */ }
  }
  // Pixel path: works in the browser (ImageData) and Node (@napi-rs getImageData).
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    return { imageData, width, height };
  } catch { /* fall through to a raw buffer */ }
  // Last resort (Node napi): copy raw RGBA pixels so we at least retain frame data.
  try {
    const buffer: Uint8Array = canvas.data ? canvas.data() : new Uint8Array(width * height * 4);
    return { buffer, width, height };
  } catch {
    return { width, height };
  }
}



export class Player {
  /** All recorded frames, in order. Index === frame number. */
  frames: RecordedFrame[];
  fps: number;
  /** Display canvas + 2D ctx (browser). Undefined when running headless. */
  canvas: any;
  ctx: any;
  pixelWidth: number;
  pixelHeight: number;
  background: string;
  cameraConfig: any;

  /** The Scene instance from the most recent record() — exposes onLog, sections, etc. */
  scene?: Scene;

  /** UI hook: called with (frameIndex, timeSeconds) whenever a frame is displayed. */
  onFrame?: (frameIndex: number, time: number) => void;

  private _playing: boolean;
  private _rafId: any;
  private _current: number;
  private _playStartWall: number;
  private _playStartFrame: number;

  // Live-redraw support (Studio interactive camera): the recording Camera
  // instance, a renderer bound to the DISPLAY canvas (separate from the
  // offscreen recording renderer in record()), and a reference to the LAST
  // frame's live mobjects — retained as a single overwritten reference (not
  // per-frame storage) purely so a pointer-driven camera controller can
  // re-render the currently-paused frame on demand. `frames[]` stays
  // rasterized bitmaps only; this is an additive, opt-in path alongside it.
  private _camera: Camera | null = null;
  private _liveRenderer: CanvasRenderer | null = null;
  private _lastMobjects: any[] | null = null;

  constructor(opts: PlayerOptions = {}) {
    const q = QUALITIES[opts.quality ?? "medium"] ?? QUALITIES.medium;
    this.canvas = opts.canvas;
    this.pixelWidth = opts.pixelWidth ?? this.canvas?.width ?? q.pixelWidth;
    this.pixelHeight = opts.pixelHeight ?? this.canvas?.height ?? q.pixelHeight;
    this.fps = opts.fps ?? q.fps;
    this.background = opts.background ?? "#000000";
    this.cameraConfig = opts.camera ?? {};
    this.frames = [];
    this._playing = false;
    this._rafId = null;
    this._current = 0;
    this._playStartWall = 0;
    this._playStartFrame = 0;

    if (this.canvas) {
      // Size the display canvas to the recording resolution.
      this.canvas.width = this.pixelWidth;
      this.canvas.height = this.pixelHeight;
      this.ctx = this.canvas.getContext?.("2d");
    }
  }

  get frameCount(): number {
    return this.frames.length;
  }

  /** Total clip duration in seconds. */
  get duration(): number {
    return this.frames.length / this.fps;
  }

  /** The currently displayed frame index. */
  get currentFrame(): number {
    return this._current;
  }

  /** The recording Camera, for a Studio interactive-camera controller to mutate. */
  get camera(): Camera | null {
    return this._camera;
  }

  /** Wall-clock time of the currently displayed frame. */
  get currentTime(): number {
    return this._current / this.fps;
  }

  /**
   * Run a Scene (or a bare construct function) and record EVERY emitted frame
   * into `this.frames`. Decoupled from real time — as fast as the machine can
   * compute. After this resolves, seek()/play() give random-access playback.
   *
   * `opts.props` supports parameter-only re-render (e.g. a Studio props
   * panel calling `player.record(scene, { props })` again after an edit,
   * instead of re-`import()`ing the module): threaded into the Scene's own
   * constructor config (`config.props`) or passed as a bare construct
   * function's 2nd argument. This still re-runs `construct()` and
   * re-records every frame — it does not itself avoid that cost (see the
   * render-caching item for that).
   */
  async record(sceneOrConstruct: any, opts: { props?: any } = {}): Promise<void> {
    const camera = new Camera({
      pixelWidth: this.pixelWidth,
      pixelHeight: this.pixelHeight,
      background: this.background,
      ...this.cameraConfig,
    });

    const { canvas: off, ctx: offCtx } = await makeOffscreen(this.pixelWidth, this.pixelHeight);
    const renderer = new CanvasRenderer(offCtx, camera);

    this._camera = camera;
    this._liveRenderer = this.ctx ? new CanvasRenderer(this.ctx, camera) : null;
    this._lastMobjects = null;

    const scene = makeScene(sceneOrConstruct, { fps: this.fps, camera, props: opts.props });
    this.scene = scene;
    this.frames = [];
    this._current = 0;

    scene.frameHandler = async (mobjects: any) => {
      this._lastMobjects = mobjects;
      renderer.renderScene(mobjects);
      const frame = await snapshot(off, offCtx, this.pixelWidth, this.pixelHeight);
      this.frames.push(frame);
    };

    scene.log("record", "recording started", {
      pixelWidth: this.pixelWidth, pixelHeight: this.pixelHeight, fps: this.fps,
    });
    await runConstruct(sceneOrConstruct, scene, opts.props);
    scene.log("record", "recording finished", { frames: this.frames.length, duration: this.duration });

    // Show the first frame if we have a display surface.
    if (this.frames.length) this.seek(0);
  }

  /** Draw a stored frame to the display canvas and fire onFrame. */
  seek(frameIndex: number): void {
    if (this.frames.length === 0) return;
    const i = Math.max(0, Math.min(this.frames.length - 1, Math.floor(frameIndex)));
    this._current = i;
    this.drawFrameTo(this.ctx, i);
    this.onFrame?.(i, i / this.fps);
  }

  /** Seek to a time in seconds. */
  seekTime(seconds: number): void {
    this.seek(Math.round(seconds * this.fps));
  }

  /**
   * Seek to a fractional position in [0, 1] across the full recorded clip
   * (0 = first frame, 1 = last frame), clamped. Convenience for driving
   * playback from an external 0..1 progress value instead of a frame index
   * or a time — e.g. `bindPlayerToScroll()` below, which maps scroll
   * progress straight onto this.
   */
  seekFraction(progress: number): void {
    if (this.frames.length === 0) return;
    const p = Math.max(0, Math.min(1, progress));
    this.seek(Math.round(p * (this.frames.length - 1)));
  }

  /**
   * Re-render the LAST recorded frame's live mobjects straight to the display
   * canvas, reflecting the current state of `this.camera` (e.g. after a
   * Studio interactive-camera pan/zoom/orbit). Unlike seek()/drawFrameTo(),
   * this does not read from `frames[]` — it re-runs `renderScene()` against
   * the live mobject list, so camera changes are visible immediately without
   * a re-record. No-op headless (no display canvas) or before any frame has
   * been recorded.
   */
  rerenderCurrentFrame(): void {
    if (!this._liveRenderer || !this._lastMobjects) return;
    this._liveRenderer.renderScene(this._lastMobjects);
  }

  /**
   * Draw a specific recorded frame to an arbitrary ctx/size -- "nearly free"
   * since every frame is already a rasterized bitmap. `seek()` uses this
   * internally (drawing to the display canvas at full size); it's also the
   * primitive behind presenter-mode "next section" thumbnails (drawing an
   * upcoming section's first frame to a small preview canvas).
   */
  drawFrameTo(
    ctx: any,
    frameIndex: number,
    opts: { width?: number; height?: number; x?: number; y?: number } = {},
  ): void {
    const frame = this.frames[frameIndex];
    if (!ctx || !frame) return;
    const w = opts.width ?? this.pixelWidth;
    const h = opts.height ?? this.pixelHeight;
    const x = opts.x ?? 0;
    const y = opts.y ?? 0;
    try {
      if (frame.bitmap) {
        ctx.drawImage(frame.bitmap, x, y, w, h);
      } else if (frame.imageData) {
        // putImageData has no scaling; only positions at (x, y).
        ctx.putImageData(frame.imageData, x, y);
      }
      // A raw buffer with no ImageData can't be blitted portably; skip drawing.
    } catch { /* unsupported drawable in this host — ignore */ }
  }

  /** Real-time playback of the recorded frames via requestAnimationFrame. */
  play(): void {
    if (this._playing || this.frames.length === 0) return;
    if (!hasRAF) return; // headless: nothing to animate against
    this._playing = true;
    // If we're at the end, restart from the top.
    if (this._current >= this.frames.length - 1) this._current = 0;
    this._playStartWall = (G.performance?.now?.() ?? Date.now());
    this._playStartFrame = this._current;

    const tick = () => {
      if (!this._playing) return;
      const now = (G.performance?.now?.() ?? Date.now());
      const elapsed = (now - this._playStartWall) / 1000;
      const target = this._playStartFrame + Math.round(elapsed * this.fps * this.playbackRate);
      // Presenter mode: pause (or loop) at the end of the current section.
      if (this.presenterMode) {
        const sec = this.sectionContaining(this._current);
        if (sec && target >= sec.endFrame - 1) {
          if (String(sec.type).includes("loop")) {
            this._playStartWall = now; this._playStartFrame = sec.startFrame;
            this.seek(sec.startFrame);
            this._rafId = G.requestAnimationFrame(tick);
            return;
          }
          this.seek(sec.endFrame - 1);
          this.pause();
          return;
        }
      }
      if (target >= this.frames.length - 1) {
        this.seek(this.frames.length - 1);
        this.pause();
        return;
      }
      this.seek(target);
      this._rafId = G.requestAnimationFrame(tick);
    };
    this._rafId = G.requestAnimationFrame(tick);
  }

  /** Stop real-time playback (holds the current frame). */
  pause(): void {
    this._playing = false;
    if (this._rafId != null && typeof G.cancelAnimationFrame === "function") {
      G.cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
  }

  /** Whether real-time playback is currently running. */
  get playing(): boolean {
    return this._playing;
  }

  // --- presenter controls (Phase 4) ----------------------------------------
  /** Playback speed multiplier (1 = normal; supports fast/slow). */
  playbackRate = 1;
  /** Audio volume in [0,1] (stored; the <manim-player> reads it). */
  volume = 1;
  /** When true, playback pauses (or loops) at each section boundary. */
  presenterMode = false;

  setPlaybackRate(rate: number): void { this.playbackRate = Math.max(0.05, rate); }
  setVolume(v: number): void { this.volume = Math.max(0, Math.min(1, v)); }

  /** The recorded scene's sections (empty if none). */
  sections(): any[] {
    return (this.scene as any)?.sections ?? [];
  }

  /** The section containing a frame index, if any. */
  sectionContaining(frame: number): any | undefined {
    for (const s of this.sections()) if (frame >= s.startFrame && frame < s.endFrame) return s;
    return undefined;
  }

  /** Seek to the start of a section (by name or index). */
  seekToSection(nameOrIndex: string | number): void {
    const secs = this.sections();
    const sec = typeof nameOrIndex === "number" ? secs[nameOrIndex] : secs.find((s) => s.name === nameOrIndex);
    if (sec) this.seek(sec.startFrame);
  }

  /** Jump to the next / previous section boundary (presenter navigation). */
  nextSection(): void {
    const secs = this.sections();
    const next = secs.find((s) => s.startFrame > this._current);
    if (next) this.seek(next.startFrame);
    else this.seek(this.frames.length - 1);
  }
  prevSection(): void {
    const secs = this.sections();
    let target = 0;
    for (const s of secs) if (s.startFrame < this._current - 1) target = s.startFrame;
    this.seek(target);
  }

  // --- step navigation (finer-grained, complementary to sections) ----------
  // Mirrors the section-navigation methods above exactly, but reads
  // scene.playRecords (already timestamps every play()/wait() call, so no
  // Scene API changes are needed) instead of sections. Steps navigate
  // independently of section boundaries. Known, deliberate limitation:
  // PlayRecord has no name/label by design, so step UI can only show
  // "step 3/17," not semantic labels.
  /** The recorded scene's play()/wait() segments (empty if none). */
  steps(): any[] {
    return (this.scene as any)?.playRecords ?? [];
  }

  /** The step containing a frame index, if any. */
  stepContaining(frame: number): any | undefined {
    for (const s of this.steps()) if (frame >= s.startFrame && frame < s.endFrame) return s;
    return undefined;
  }

  /** Seek to the start of a step (by 0-based index). */
  seekToStep(index: number): void {
    const steps = this.steps();
    const step = steps[index];
    if (step) this.seek(step.startFrame);
  }

  /** Jump to the next / previous step boundary. */
  nextStep(): void {
    const steps = this.steps();
    const next = steps.find((s) => s.startFrame > this._current);
    if (next) this.seek(next.startFrame);
    else this.seek(this.frames.length - 1);
  }
  prevStep(): void {
    const steps = this.steps();
    let target = 0;
    for (const s of steps) if (s.startFrame < this._current - 1) target = s.startFrame;
    this.seek(target);
  }
}

// =============================================================================
// Scroll binding (Campaign 7 gap-fill): the shared primitive behind GSAP
// ScrollTrigger's `scrub`, `pin`, and (via ScrollSmoother) `data-speed`
// parallax — patterns 07/08/09 of examples/gsap-parity. Deliberately a MUCH
// smaller subset than ScrollTrigger's full feature surface: just "map scroll
// position to a 0..1 progress" plus an optional viewport pin, wired to real
// `scroll`/`resize` DOM events.
// =============================================================================

/**
 * Inputs to the pure scroll-progress formula: a trigger element's geometry
 * (already resolved to plain numbers) plus the current scroll position.
 * `elementTop` must be the element's top offset within the whole scrollable
 * DOCUMENT (not viewport-relative) — i.e. `el.getBoundingClientRect().top +
 * window.scrollY` at the time of measurement.
 */
export interface ScrollProgressInput {
  elementTop: number;
  elementHeight: number;
  viewportHeight: number;
  scrollY: number;
  start?: string | number;
  end?: string | number;
}

// GSAP's ScrollTrigger accepts a loose string grammar for `start`/`end`
// ("top top", "center bottom", "+=500", ...). We implement a deliberately
// small subset of that grammar — just enough for the 3 patterns this
// campaign targets, not the full ScrollTrigger DSL:
//
//   "<edge> <viewportEdge>"   edge/viewportEdge each one of top|center|bottom.
//                             Resolves to the absolute document scrollY at
//                             which the element's edge lines up with that
//                             point in the viewport (the exact formula
//                             ScrollTrigger itself uses):
//                               elementRef  = elementTop + elementHeight * edgeFrac
//                               viewportRef = viewportHeight * viewportFrac
//                               scrollY     = elementRef - viewportRef
//   "+=N" / "-=N"             a pixel offset RELATIVE to the resolved `start`
//                             value (only meaningful for `end`).
//   <number>                  an absolute document scrollY, taken as-is.
//
// Defaults when `start`/`end` are omitted: start = "top top" (range begins
// the instant the element's top hits the viewport top), end = "bottom top"
// (range ends when the element's bottom passes the viewport top) — i.e. by
// default the scroll range spans exactly one elementHeight, edge to edge.
//
// Progress is the linear fraction of the current scrollY between the
// resolved start/end scrollY values, clamped to [0, 1]:
//
//   progress = clamp((scrollY - startY) / (endY - startY), 0, 1)

function resolveEdgeString(spec: string, elementTop: number, elementHeight: number, viewportHeight: number): number {
  const [edgeRaw, viewportRaw] = spec.trim().split(/\s+/);
  const edgeFrac = edgeRaw === "top" ? 0 : edgeRaw === "bottom" ? 1 : 0.5; // "center" (or unrecognized)
  const viewportFrac = viewportRaw === "top" ? 0 : viewportRaw === "bottom" ? 1 : 0.5;
  return (elementTop + elementHeight * edgeFrac) - (viewportHeight * viewportFrac);
}

/** Resolve a `start`/`end` spec (number | "<edge> <viewportEdge>" | "+=N"/"-=N") into an absolute document scrollY. */
function resolveScrollPos(
  spec: string | number | undefined,
  fallback: string,
  elementTop: number,
  elementHeight: number,
  viewportHeight: number,
  relativeBase: number,
): number {
  const s = spec ?? fallback;
  if (typeof s === "number") return s;
  const rel = /^([+-]=)(\d+(?:\.\d+)?)$/.exec(s.trim());
  if (rel) return relativeBase + (rel[1] === "+=" ? 1 : -1) * parseFloat(rel[2]);
  return resolveEdgeString(s, elementTop, elementHeight, viewportHeight);
}

/**
 * Pure math core of scroll binding: map a scroll position + trigger geometry
 * to a clamped 0..1 progress value. No DOM access whatsoever — fully
 * Node-testable in isolation from the DOM-event-wiring in bindScroll() below.
 * See the format notes above for the `start`/`end` mini-DSL.
 */
export function computeScrollProgress(input: ScrollProgressInput): number {
  const { elementTop, elementHeight, viewportHeight, scrollY } = input;
  const startY = resolveScrollPos(input.start, "top top", elementTop, elementHeight, viewportHeight, 0);
  const endY = resolveScrollPos(input.end, "bottom top", elementTop, elementHeight, viewportHeight, startY);
  if (endY <= startY) return scrollY >= startY ? 1 : 0; // degenerate zero/negative-length range
  return Math.max(0, Math.min(1, (scrollY - startY) / (endY - startY)));
}

export interface ScrollBindingOptions {
  /** The element whose scroll-position-within-viewport drives playback
   *  (typically a tall "scroll spacer" wrapping/preceding the pinned/scrubbed
   *  content — matches ScrollTrigger's `trigger` element). */
  trigger: any; // HTMLElement in the browser
  /** Range start; see the mini-DSL notes above. Default: "top top". */
  start?: string | number;
  /** Range end; see the mini-DSL notes above. Default: "bottom top". */
  end?: string | number;
  /** Called with scroll progress 0..1 (already clamped) whenever it changes,
   *  rAF-throttled (never synchronously on every scroll event). */
  onProgress: (progress: number) => void;
  /** Pin the trigger element in the viewport (position: fixed) while progress
   *  is strictly within (0, 1), matching ScrollTrigger's pin:true (pattern
   *  08). Unpinned (normal flow) at progress 0 or 1. Default: false — 07/09
   *  don't pin. No spacer element is inserted (deliberately, to keep this
   *  small): once pinned, the trigger leaves normal flow, which will shift
   *  layout below it, exactly like ScrollTrigger without `pinSpacing`. */
  pin?: boolean;
}

export interface ScrollBinding {
  /** Tear down all listeners (scroll/resize) and undo any pin styling. */
  destroy(): void;
  /** Force a re-measure of the trigger's geometry + recompute (e.g. after an
   *  external layout change), same as what a `resize` event triggers. */
  refresh(): void;
}

interface ScrollGeometry {
  elementTop: number;
  elementHeight: number;
  viewportHeight: number;
  left: number;
  width: number;
}

/**
 * Bind an element's scroll-position-within-viewport to a progress callback —
 * a small subset of GSAP ScrollTrigger's scrub/pin core (just the
 * scroll-to-progress mapping + optional pin, not its full feature surface).
 *
 * Browser-only: throws a clear error (never a silent no-op) if `window`/
 * `document` aren't present, mirroring this file's `hasDocument`-style
 * capability-probe convention (see the top of player.ts). Note this check is
 * intentionally evaluated fresh on every call rather than reusing the
 * module-level `hasDocument` const — that const is captured once at import
 * time, whereas bindScroll() may run in a test harness that installs a fake
 * `window`/`document` on `globalThis` AFTER this module has already loaded;
 * a live check is required for that to work. Behavior in real Node/browser
 * processes is identical either way (neither appears/disappears mid-process).
 *
 * Geometry (element position, height, viewport height) is measured ONCE up
 * front and cached — matching real ScrollTrigger, which measures at
 * setup/refresh time rather than re-measuring on every scroll — so `scroll`
 * events only read `window.scrollY` and recompute the pure progress formula;
 * call `refresh()` (or fire `resize`) after any layout change.
 */
export function bindScroll(options: ScrollBindingOptions): ScrollBinding {
  const win: any = (globalThis as any).window;
  const doc: any = (globalThis as any).document;
  if (typeof win === "undefined" || typeof doc === "undefined") {
    throw new Error(
      "bindScroll() requires a browser DOM (window/document) -- it wires up " +
      "real scroll/resize listeners, which don't exist under plain Node. " +
      "Guard call sites the same way other browser-only code in player.ts " +
      "does (see the hasDocument capability probe near the top of this file).",
    );
  }

  const { trigger, start, end, onProgress, pin = false } = options;

  let cachedGeo: ScrollGeometry | null = null;
  let lastProgress: number | null = null;
  let rafId: any = null;
  let pendingResize = false;
  let pinned = false;
  let pinStyles: { position: string; top: string; left: string; width: string; zIndex: string } | null = null;

  function measureGeometry(): ScrollGeometry {
    const rect = trigger.getBoundingClientRect();
    return {
      elementTop: rect.top + win.scrollY,
      elementHeight: rect.height,
      viewportHeight: win.innerHeight,
      left: rect.left,
      width: rect.width,
    };
  }

  function applyPin(geo: ScrollGeometry): void {
    if (pinned) return;
    pinStyles = {
      position: trigger.style.position, top: trigger.style.top,
      left: trigger.style.left, width: trigger.style.width, zIndex: trigger.style.zIndex,
    };
    trigger.style.position = "fixed";
    trigger.style.top = "0px";
    trigger.style.left = `${geo.left}px`;
    trigger.style.width = `${geo.width}px`;
    trigger.style.zIndex = trigger.style.zIndex || "1";
    pinned = true;
  }

  function removePin(): void {
    if (!pinned) return;
    if (pinStyles) {
      trigger.style.position = pinStyles.position;
      trigger.style.top = pinStyles.top;
      trigger.style.left = pinStyles.left;
      trigger.style.width = pinStyles.width;
      trigger.style.zIndex = pinStyles.zIndex;
    }
    pinned = false;
    pinStyles = null;
  }

  function refreshGeometry(): void {
    // If currently pinned (position: fixed), its rect is viewport-relative,
    // not document-relative -- unpin first so we measure the NATURAL flow
    // position, then restore pin state against the fresh measurement.
    const wasPinned = pinned;
    if (wasPinned) removePin();
    cachedGeo = measureGeometry();
    if (wasPinned) applyPin(cachedGeo);
  }

  function recompute(): void {
    if (!cachedGeo) cachedGeo = measureGeometry();
    const progress = computeScrollProgress({ ...cachedGeo, scrollY: win.scrollY, start, end });
    if (pin) {
      if (progress > 0 && progress < 1) applyPin(cachedGeo);
      else removePin();
    }
    if (progress !== lastProgress) {
      lastProgress = progress;
      onProgress(progress);
    }
  }

  function schedule(): void {
    if (rafId != null) return;
    rafId = win.requestAnimationFrame(() => {
      rafId = null;
      if (pendingResize) { refreshGeometry(); pendingResize = false; }
      recompute();
    });
  }

  function onScrollEvent(): void { schedule(); }
  function onResizeEvent(): void { pendingResize = true; schedule(); }

  win.addEventListener("scroll", onScrollEvent, { passive: true });
  win.addEventListener("resize", onResizeEvent);
  refreshGeometry();
  recompute(); // establish + report the initial state synchronously

  return {
    destroy(): void {
      win.removeEventListener("scroll", onScrollEvent);
      win.removeEventListener("resize", onResizeEvent);
      if (rafId != null && typeof win.cancelAnimationFrame === "function") win.cancelAnimationFrame(rafId);
      removePin();
    },
    refresh(): void {
      if (rafId != null && typeof win.cancelAnimationFrame === "function") { win.cancelAnimationFrame(rafId); rafId = null; }
      pendingResize = false;
      refreshGeometry();
      recompute();
    },
  };
}

/**
 * Convenience: bind a scroll range directly to a Player's playback position
 * — drives `player.seekFraction()` (frame index) from scroll progress
 * instead of real-time playback via `play()`. This is pattern 07's exact
 * need (a timeline scrubbed by scroll, in both directions) and composes
 * directly with `pin: true` for pattern 08 (pin the trigger while the SAME
 * progress drives the Player).
 *
 * Pattern 09 (parallax layers) needs no new primitive beyond bindScroll()
 * itself: call bindScroll() once per layer (or share one binding's
 * onProgress across N layers, which is cheaper — one listener instead of N)
 * and apply `translateY(progress * range * speed)` per layer with a
 * different `speed` multiplier each.
 */
export function bindPlayerToScroll(player: Player, options: Omit<ScrollBindingOptions, "onProgress">): ScrollBinding {
  return bindScroll({
    ...options,
    onProgress: (progress) => player.seekFraction(progress),
  });
}

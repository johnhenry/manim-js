// A caption overlay mobject: shows the active caption for the current scene time,
// with optional karaoke-style left-to-right reveal. Reuses RasterText's existing
// `revealFraction` (the same field drawText uses for typewriter clipping). The
// updater accumulates dt, so it stays in sync through play()/wait().
//
// WordCaptionTrack below is the per-token sibling: one RasterText per word so
// the active token can be individually colored/scaled (TikTok/Submagic style),
// which single-fillStyle CaptionTrack can't do.

import { Group } from "../mobject/Mobject.ts";
import { RasterText, estimateTextSize } from "../mobject/text/Text.ts";
import { Color } from "../core/color.ts";
import { captionAt } from "./captions.ts";
import type { Caption, CaptionPage } from "./captions.ts";

export interface CaptionTrackConfig {
  fontSize?: number;
  color?: string;
  point?: number[];
  align?: "left" | "center" | "right";
  /** Reveal the active caption progressively (default false = show whole). */
  karaoke?: boolean;
  /** Start time offset in ms (default 0). */
  offsetMs?: number;
}

export class CaptionTrack extends RasterText {
  captions: Caption[];
  karaoke: boolean;
  private _elapsedMs: number;

  constructor(captions: Caption[], config: CaptionTrackConfig = {}) {
    super("", {
      fontSize: config.fontSize ?? 0.45,
      color: config.color ?? "#FFFFFF",
      align: config.align ?? "center",
      point: config.point ?? [0, -3, 0],
    });
    this.captions = captions;
    this.karaoke = config.karaoke ?? false;
    this._elapsedMs = config.offsetMs ?? 0;
    this.addUpdater((_m: any, dt: number) => this._tick(dt));
    this._render(); // initial frame
  }

  private _tick(dt: number): void {
    this._elapsedMs += dt * 1000;
    this._render();
  }

  private _render(): void {
    const c = captionAt(this.captions, this._elapsedMs);
    this.text = c ? c.text : "";
    if (this.karaoke && c) {
      const span = Math.max(1, c.endMs - c.startMs);
      this.revealFraction = Math.max(0, Math.min(1, (this._elapsedMs - c.startMs) / span));
    } else {
      this.revealFraction = 1;
    }
  }

  /** Jump the caption clock to `ms` (e.g. when seeking). */
  seekMs(ms: number): this {
    this._elapsedMs = ms;
    this._render();
    return this;
  }
}

// ---------------------------------------------------------------------------
// WordCaptionTrack
// ---------------------------------------------------------------------------

export interface WordHighlightConfig {
  /** Active-token color (default "#FFE066"). */
  color?: string;
  /** Not-yet-spoken token color (defaults to the base color). */
  inactiveColor?: string;
  /** Active-token scale after the pop settles (default 1.15). */
  scale?: number;
  /** Pop-in duration in ms (default 120). */
  popMs?: number;
  /** Opacity of not-yet-spoken tokens (default 0.4). */
  futureOpacity?: number;
}

export interface WordCaptionTrackConfig {
  fontSize?: number;
  font?: string;
  weight?: string;
  /** Base (already-spoken) token color (default "#FFFFFF"). */
  color?: string;
  /** Center of the caption block (default [0, -3, 0]). */
  point?: number[];
  /** Wrap tokens onto new lines past this world-unit width. */
  maxWidth?: number;
  /** Line height multiplier (default 1.25). */
  lineSpacing?: number;
  /** Start time offset in ms (default 0). */
  offsetMs?: number;
  highlight?: WordHighlightConfig;
}

interface TokenSlot {
  text: RasterText;
  fromMs: number;
  toMs: number;
  center: [number, number];
  halfW: number;
  halfH: number;
}

/**
 * Word-level karaoke captions: consumes `CaptionPage[]` (from
 * `createTikTokStyleCaptions`) and renders one RasterText per token, so the
 * active word can pop and change color independently (TikTok/Submagic style).
 * Layout is computed once per page; per-frame work only mutates each token's
 * color/opacity/box (all pure functions of the elapsed clock — scrubbing and
 * `seekMs` in either direction land on identical frames).
 */
export class WordCaptionTrack extends Group {
  pages: CaptionPage[];
  /** The current page's token mobjects, in token order (empty between pages). */
  tokenTexts: RasterText[] = [];
  private _cfg: Required<Pick<WordCaptionTrackConfig, "fontSize" | "color" | "lineSpacing">> & WordCaptionTrackConfig;
  private _hl: Required<WordHighlightConfig>;
  private _elapsedMs: number;
  private _pageIndex = -1;
  private _slots: TokenSlot[] = [];
  private _baseColor: Color;
  private _activeColor: Color;
  private _inactiveColor: Color;

  constructor(pages: CaptionPage[], config: WordCaptionTrackConfig = {}) {
    super();
    this.pages = pages;
    this._cfg = { fontSize: 0.45, color: "#FFFFFF", lineSpacing: 1.25, ...config };
    const hl = config.highlight ?? {};
    this._hl = {
      color: hl.color ?? "#FFE066",
      inactiveColor: hl.inactiveColor ?? this._cfg.color,
      scale: hl.scale ?? 1.15,
      popMs: hl.popMs ?? 120,
      futureOpacity: hl.futureOpacity ?? 0.4,
    };
    this._baseColor = Color.parse(this._cfg.color);
    this._activeColor = Color.parse(this._hl.color);
    this._inactiveColor = Color.parse(this._hl.inactiveColor);
    this._elapsedMs = config.offsetMs ?? 0;
    this.addUpdater((_m: any, dt: number) => {
      this._elapsedMs += dt * 1000;
      this._render();
    });
    this._render();
  }

  /** The index of the page currently displayed, or -1 between pages. */
  get currentPageIndex(): number {
    return this._pageIndex;
  }

  /** Jump the caption clock to `ms` (either direction — layout is stateless). */
  seekMs(ms: number): this {
    this._elapsedMs = ms;
    this._render();
    return this;
  }

  private _pageAt(ms: number): number {
    for (let i = 0; i < this.pages.length; i++) {
      const p = this.pages[i];
      if (ms >= p.startMs && ms < p.startMs + Math.max(1, p.durationMs)) return i;
    }
    return -1;
  }

  private _render(): void {
    const idx = this._pageAt(this._elapsedMs);
    if (idx !== this._pageIndex) {
      this._pageIndex = idx;
      this._layoutPage(idx === -1 ? null : this.pages[idx]);
    }
    this._styleTokens();
  }

  /** Build one RasterText per token and lay them out (with maxWidth wrap). */
  private _layoutPage(page: CaptionPage | null): void {
    this.submobjects.length = 0;
    this.tokenTexts = [];
    this._slots = [];
    if (!page) return;
    const { fontSize, maxWidth, lineSpacing } = this._cfg;
    const lineHeight = fontSize * 1.2 * lineSpacing;
    const spaceW = estimateTextSize(" ", fontSize).width;

    // First pass: greedy wrap into lines of token indices.
    interface Measured { token: (typeof page.tokens)[number]; label: string; w: number }
    const measured: Measured[] = page.tokens
      .map((token) => {
        const label = token.text.trim();
        return { token, label, w: estimateTextSize(label, fontSize).width };
      })
      .filter((m) => m.label.length > 0);
    const lines: Measured[][] = [];
    let line: Measured[] = [];
    let lineW = 0;
    for (const m of measured) {
      const extra = (line.length ? spaceW : 0) + m.w;
      if (line.length && maxWidth != null && lineW + extra > maxWidth) {
        lines.push(line);
        line = [m];
        lineW = m.w;
      } else {
        line.push(m);
        lineW += extra;
      }
    }
    if (line.length) lines.push(line);

    // Second pass: place tokens, centering each line and the whole block.
    const [cx, cy] = this._cfg.point ?? [0, -3, 0];
    const blockH = lines.length * lineHeight;
    lines.forEach((ln, li) => {
      const totalW = ln.reduce((s, m) => s + m.w, 0) + spaceW * (ln.length - 1);
      let x = cx - totalW / 2;
      const y = cy + blockH / 2 - lineHeight * (li + 0.5);
      for (const m of ln) {
        const text = new RasterText(m.label, {
          fontSize,
          color: this._cfg.color,
          ...(this._cfg.font ? { font: this._cfg.font } : {}),
          ...(this._cfg.weight ? { weight: this._cfg.weight } : {}),
        });
        const halfW = m.w / 2;
        const halfH = (fontSize * 1.2) / 2;
        const center: [number, number] = [x + halfW, y];
        this._slots.push({ text, fromMs: m.token.fromMs, toMs: m.token.toMs, center, halfW, halfH });
        this.tokenTexts.push(text);
        x += m.w + spaceW;
      }
    });
    this.add(...this.tokenTexts);
  }

  /** Pure function of the clock: color/opacity/scale per token, no state. */
  private _styleTokens(): void {
    const t = this._elapsedMs;
    for (const slot of this._slots) {
      const { text, fromMs, toMs, center, halfW, halfH } = slot;
      let scale = 1;
      if (t < fromMs) {
        text.fillColor = this._inactiveColor;
        text.fillOpacity = this._hl.futureOpacity;
        text.opacity = this._hl.futureOpacity;
      } else if (t < toMs) {
        text.fillColor = this._activeColor;
        text.fillOpacity = 1;
        text.opacity = 1;
        // Pop-in: smoothstep 1 -> hl.scale over popMs, then hold while active.
        const p = Math.min(1, (t - fromMs) / Math.max(1, this._hl.popMs));
        const s = p * p * (3 - 2 * p);
        scale = 1 + (this._hl.scale - 1) * s;
      } else {
        text.fillColor = this._baseColor;
        text.fillOpacity = 1;
        text.opacity = 1;
      }
      const w = halfW * scale;
      const h = halfH * scale;
      text.points = [
        [center[0] - w, center[1] + h, 0],
        [center[0] + w, center[1] + h, 0],
        [center[0] + w, center[1] - h, 0],
        [center[0] - w, center[1] - h, 0],
      ];
    }
  }
}

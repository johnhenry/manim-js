// Voiceover: synthesize narration, add it to the scene at the current time, and
// give back a tracker whose `.duration` you feed into play({runTime}) so
// animations stretch to the speech. Inline `<bookmark mark="name"/>` tags let you
// trigger animations at specific words via `waitUntilBookmark("name")`.
// Modeled on manim-voiceover, adapted to an async callback (no Python `with`).
//
//   await voiceover(this, "First <bookmark mark='a'/> then second.", async (vt) => {
//     await this.play(new Create(a), { _playConfig: true, runTime: vt.duration });
//     await vt.waitUntilBookmark("a");
//     await this.play(new Create(b));
//   });

import { resolveTTSProvider } from "./providers.ts";
import type { TTSSynthesizeOptions, WordBoundary } from "./providers.ts";

export interface Bookmark { name: string; charIndex: number; }

/** Strip <bookmark mark="name"/> tags, returning clean text + tag char positions. */
export function parseBookmarks(text: string): { clean: string; bookmarks: Bookmark[] } {
  const bookmarks: Bookmark[] = [];
  let clean = "";
  const re = /<bookmark\s+mark\s*=\s*["']([^"']+)["']\s*\/?>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    clean += text.slice(last, m.index);
    bookmarks.push({ name: m[1], charIndex: clean.length });
    last = m.index + m[0].length;
  }
  clean += text.slice(last);
  return { clean: clean.trim(), bookmarks };
}

// Map a character index in the clean text to a time (seconds), using word
// boundaries if available, else proportional to character position.
function charIndexToTime(
  charIndex: number,
  cleanText: string,
  durationSeconds: number,
  wordBoundaries?: WordBoundary[],
): number {
  if (!cleanText.length) return 0;
  if (wordBoundaries && wordBoundaries.length) {
    // Count words up to charIndex, then take that word boundary's start.
    const before = cleanText.slice(0, charIndex).trim();
    const wordIndex = before.length ? before.split(/\s+/).length : 0;
    const wb = wordBoundaries[Math.min(wordIndex, wordBoundaries.length - 1)];
    return (wb?.startMs ?? 0) / 1000;
  }
  return (charIndex / cleanText.length) * durationSeconds;
}

export class VoiceoverTracker {
  readonly duration: number;
  /**
   * How bookmark times were derived. "word-boundaries" means the TTS provider
   * returned per-word timings and bookmarks are exact; "proportional" means the
   * bookmark time is estimated from its character offset (speech pace varies,
   * so expect drift of up to a few hundred ms on real narration).
   */
  readonly timingSource: "word-boundaries" | "proportional";
  private scene: any;
  private startTime: number;
  private bookmarkTimes: Map<string, number>;

  constructor(
    scene: any,
    duration: number,
    startTime: number,
    bookmarkTimes: Map<string, number>,
    timingSource: "word-boundaries" | "proportional" = "proportional",
  ) {
    this.scene = scene;
    this.duration = duration;
    this.startTime = startTime;
    this.bookmarkTimes = bookmarkTimes;
    this.timingSource = timingSource;
  }

  /** Absolute scene time (seconds) of a bookmark. */
  timeAtBookmark(name: string): number {
    const t = this.bookmarkTimes.get(name);
    if (t == null) throw new Error(`voiceover: no bookmark "${name}"`);
    return this.startTime + t;
  }

  /** Seconds from now until a bookmark (>= 0). */
  timeUntilBookmark(name: string): number {
    return Math.max(0, this.timeAtBookmark(name) - this.scene.time);
  }

  /** Advance the scene (a wait) until the given bookmark. */
  async waitUntilBookmark(name: string): Promise<void> {
    const dt = this.timeUntilBookmark(name);
    if (dt > 1e-3) await this.scene.wait(dt);
  }
}

export interface VoiceoverOptions extends TTSSynthesizeOptions {
  /** Preferred provider name (else the first available; falls back to "silent"). */
  provider?: string;
  gain?: number;
}

/**
 * Run `callback` under a synthesized voiceover. Synthesizes the narration, adds
 * it to the scene at the current time, invokes `callback(tracker)`, then waits
 * for any remaining audio so the scene time reaches the end of the clip.
 */
export async function voiceover(
  scene: any,
  text: string,
  callback: (tracker: VoiceoverTracker) => Promise<void> | void,
  options: VoiceoverOptions = {},
): Promise<VoiceoverTracker> {
  const { clean, bookmarks } = parseBookmarks(text);
  const provider = await resolveTTSProvider(options.provider);
  const result = await provider.synthesize(clean, options);
  const duration = result.durationSeconds || 0;

  const bookmarkTimes = new Map<string, number>();
  for (const b of bookmarks) {
    bookmarkTimes.set(b.name, charIndexToTime(b.charIndex, clean, duration, result.wordBoundaries));
  }

  const startTime = scene.time;
  if (result.file) scene.addSound(result.file, { timeOffset: startTime, gain: options.gain ?? 1 });

  const timingSource = result.wordBoundaries?.length ? "word-boundaries" as const : "proportional" as const;
  const tracker = new VoiceoverTracker(scene, duration, startTime, bookmarkTimes, timingSource);
  await callback(tracker);

  const remaining = startTime + duration - scene.time;
  if (remaining > 1e-2) await scene.wait(remaining);
  return tracker;
}

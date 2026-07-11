# Reveal.js / Slidev parity suite

**The presentation finale — and the last campaign in the roadmap.** One
markdown source drives a real Reveal.js/Slidev-style deck AND a rendered,
narrated video. Turns out most of what this needed was already built by
earlier campaigns: `Scene.nextSection()` already carried presenter-mode
speaker notes, `Player.steps()` already derived fragment navigation from
`scene.playRecords`, `Scene.autoAnimateToNextSection()` already did the
Auto-Animate snapshot+match transition, `Player.presenterMode` already
paused at section boundaries, `Code.selection()` already drove highlight
steps, and `voiceover()` already had `<bookmark>`-synced narration. One
real gap remained: a markdown deck loader.

```bash
ECMANIM_DEMO_QUALITY=low npx tsx examples/reveal-slidev-parity/06-rendered-narration.ts
npm run demos:reveal   # everything
```

Corpus: verbatim demo decks from both frameworks (MIT) in
[`ref/`](./ref/) — `reveal-demo.html` (trimmed from reveal.js's own
`demo.html`) and `slidev-demo.md` (the unmodified official Slidev starter
template); provenance in [`ref/README.md`](./ref/README.md).

## Scorecard — 6/6 rendered & frame-verified

| # | Demo | Proves |
|---|------|--------|
| 01 | markdown-deck | **`deckFromMarkdown()`** end to end — headings, `---` separators, incremental bullet fragments, a math slide, both speaker-notes forms |
| 02 | auto-animate-pair | `Scene.autoAnimateToNextSection()` (pre-existing) — a card's position/size/color smoothly interpolates across 3 slides via a stable `matchId` |
| 03 | code-walkthrough | `Code.selection(lines(...))` (pre-existing) stepped through 5 highlight states, one `play()` per step |
| 04 | vertical-stacks | reveal.js's nested-section "drill down" concept, built directly on `Scene.nextSection()` with a breadcrumb/inset-panel visual cue |
| 05 | backgrounds-transitions | per-slide background swap (solid/gradient/zoom-transition), each faded individually |
| 06 | **rendered-narration** | **the roadmap's named "surpass"**: a markdown deck rendered to mp4 WITH synced spoken narration (`voiceover()` + `<bookmark>` tags, `"silent"` TTS provider) — one source, live deck AND narrated video, which real Reveal.js/Slidev cannot do |

## The gap-fill (this campaign's one real addition)

Personal API smoke-testing found the whole substrate essentially complete
already — no fan-out needed. The single gap: **`deckFromMarkdown()`**
(`src/loaders/deck_markdown.ts`) — a loader for a deliberately GENERIC
presentation-markdown dialect (headings, `---` separators, bullet lists,
fenced code with Slidev-style `{2,4-6}`/`{all|2|4-6|all}` line-highlight-step
annotations, `$$...$$` math, trailing-HTML-comment or `<aside
class="notes">` speaker notes) — NOT a full Reveal.js or Slidev markdown
engine. Real Slidev decks embed Vue components, UnoCSS classes, and
frontmatter-driven layout switching (see `ref/slidev-demo.md`) that are out
of scope for a generic loader; the corpus decks are hand-adapted onto this
dialect or the Scene API directly in the ports, not fed through as a
literal converter.

## Bugs found & fixed (both by frame-verification, not code review)

- **Fading a wrapper group left content stacking on screen.** Grouping a
  slide's mobjects into a `VGroup` and calling `FadeOut(wrapper)` doesn't
  work unless the wrapper itself is also a scene member — `FadeOut`'s
  `finish()` deliberately restores the animated mobject's opacity to full
  right after fading (manim parity: a mobject shown again later shouldn't
  inherit opacity 0), which is only correct if the removal actually took it
  out of the render tree. Since the wrapper was never added to
  `scene.mobjects` (only its individually-`FadeIn`'d children were), every
  "faded out" slide snapped back to full opacity and visibly stacked on the
  next one. Fixed by animating each mobject directly.
- **Bullets rendering off the left edge.** `Text.moveTo()` centers the
  bounding box on the given point, not left-anchors it — a fixed x offset
  combined with long, unwrapped bullet text pushed the left edge well past
  the frame boundary. Fixed with a word-wrap width.

## Honest divergences

- Vertical stacks (04) are a presenter-navigation-UI concept with no real
  rendered-video equivalent — approximated with a breadcrumb + inset panel.
- Real Slidev's Vue-component/UnoCSS/frontmatter-layout richness is out of
  `deckFromMarkdown()`'s scope; it targets a generic markdown subset both
  frameworks' AUTHORING conventions overlap on.
- A shared `out/partial/` render-cache directory can splice in footage from
  a different, concurrently-rendering demo if multiple Node processes
  target the same cache dir at once (found during this campaign's parallel
  port wave, not present in the sequentially-rendered shipped corpus) — a
  real concurrency risk worth a dedicated fix pass, not attempted here.

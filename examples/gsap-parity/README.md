# GSAP parity suite

**A pattern canon, not a gallery port.** GSAP's own docs are the source —
13 illustrative patterns (timeline sequencing, staggers, morphs, motion
paths, FLIP, scroll-driven playback) recreated on ecmanim's animation
primitives, proving both the rendered-video side (10 patterns → mp4) and the
browser-player side (3 scroll-driven patterns → live HTML pages, since a
video has no scroll input).

```bash
ECMANIM_DEMO_QUALITY=low npx tsx examples/gsap-parity/06-flip-transition.ts
npm run demos:gsap   # the 10 video demos
npx serve examples/gsap-parity/browser   # then open 07/08/09 in a browser
```

Corpus: short (5-15 line), cited quotes from GreenSock's public docs per
pattern — not bulk copies — in [`ref/`](./ref/); provenance + the
`draggable`-is-out-of-scope note in [`ref/README.md`](./ref/README.md).

## Scorecard — 13/13 recreated & verified

| # | Demo | Proves | Verified via |
|---|------|--------|---------------|
| 01 | timeline-labels | `Timeline`'s position-parameter grammar (`<`, `>`, `-=`, `+=`, label refs) | frame-check |
| 02 | stagger-distributions | **`staggerGrid()`** — true 2D grid proximity (`from:"center"/"edges"/"random"`), not array order | frame-check |
| 03 | text-split-reveal | **`Text.words()`**/`.chars` — word- and char-level staggered reveal | frame-check |
| 04 | shape-morph | `TransformMatchingShapes({transformMismatches:true})` — real point-interpolated morph | frame-check |
| 05 | motion-path-autorotate | **`MoveAlongPath.autoRotate`** — orientation tracks the path tangent | frame-check |
| 06 | flip-transition | **`flipGetState()`/`flipFrom()`** — the FLIP technique (capture → instant change → animate the delta) | frame-check |
| 07 | scroll-scrubbed-timeline | **`bindPlayerToScroll()`** — scroll position 1:1 drives playback | live browser, 3 scroll depths |
| 08 | pin-progress | **`bindScroll({pin:true})`** — element pins, then releases, across a scroll range | live browser, 3 scroll depths |
| 09 | parallax-layers | `bindScroll()` driving N layers at different speed multipliers | live browser, 3 scroll depths |
| 10 | elastic-back-easing | `easeOutElastic` vs `easeOutBack` side by side, same tween | frame-check |
| 11 | repeat-yoyo | `Repeat({count, yoyo:true})` — finite ping-pong (GSAP's `repeat:-1` has no finite-video equivalent) | frame-check |
| 12 | keyframes-syntax | `KeyframeTrack` — multi-stage sequential pose with per-segment eases | frame-check |
| 13 | onupdate-callback | `UpdateFromAlphaFunc` driving a live readout alongside a concurrent tween | frame-check |

## The gap-fill (this campaign's library additions)

Personal API smoke-testing (in place of a large assessment fan-out — this
campaign's 13 single-API-existence checks were faster to verify directly
than to delegate) found MOST patterns already reproducible:
`Timeline.addLabel`, `Text.chars`, `TransformMatchingShapes`/`Auto`,
`easeOutElastic`/`easeOutBack`, `Repeat`+`yoyo`, `KeyframeTrack`,
`UpdateFromAlphaFunc` all existed. Five real gaps:

- **`staggerGrid`** (`src/animation/stagger.ts`) — GSAP-style grid-aware
  stagger: `from:"start"/"end"/"center"/"edges"/"random"/index/[row,col]`,
  true 2D proximity. `"random"` is deterministic (seeded via `mulberry32` by
  index) — this project's cache-safety requirement.
- **`MoveAlongPath.autoRotate`** (`src/animation/extra.ts`) — orients the
  mobject to the path's tangent (`VMobject.tangentAtProportion`) as it
  travels.
- **`Text.words()`/`.lines()`** (`src/mobject/text/Text.ts`) — group the
  existing per-glyph `chars` VGroup into word/line-level VGroups, sharing
  mobject identity with `chars`.
- **FLIP helper** (`src/animation/flip.ts`, new) — `flipGetState()`/
  `flipFrom()`.
- **Player scroll-binding** (`src/player.ts`) — `bindScroll()`/
  `bindPlayerToScroll()`, a ScrollTrigger scrub/pin subset;
  `computeScrollProgress()` is the pure, Node-testable math core.

## Bugs found & fixed

- **`Timeline`'s compound `"label+=n"` form.** GSAP's own docs example
  (`tl.to(x, {...}, "scene1+=3")`) threw "unknown position" — `resolve()`
  handled bare `"+=n"` (relative to cursor) and bare label lookup, but not
  the compound label-plus-offset form. Found by the exemplar port, fixed
  with a regression test.
- **`examples/browser/index.html`** called `Rotate(...)`/`Transform(...)`
  (real ES classes) without `new` — would throw at runtime if exercised.
  Found while building the 07-09 browser demos; fixed.

## Honest divergences

- `draggable` (interactive pointer-dragging) is out of scope — no
  meaningful rendered-video or scroll-driven equivalent.
- `repeat: -1` (infinite) has no finite-video equivalent; 11-repeat-yoyo
  uses a finite `count` instead (`Repeat` itself enforces this — it throws
  on a non-finite count by design).
- SplitText and MorphSVG are recreated as PATTERNS (structure/behavior),
  not their paid-plugin internals.
- `bindScroll({pin:true})` does not insert GSAP's `pinSpacing` — callers
  must add compensating spacer height manually (documented in the JSDoc).

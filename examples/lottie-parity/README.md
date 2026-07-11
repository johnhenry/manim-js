# Lottie parity suite

**Real Lottie files, deterministically played.** `loadLottie(json)` turns a
Bodymovin/Lottie animation into a scrub-safe `LottieMobject` — a full keyframe
engine (cubic-bezier easing + spatial tangents), the shape-item tree, layer
parenting, precomps, and CompositeGroup-backed **masks and track mattes** —
posed as a pure function of time so it renders headlessly to video, cache-safe
and NaN-free, on the same Canvas-2D path as everything else.

```bash
ECMANIM_DEMO_QUALITY=low npx tsx examples/lottie-parity/05-navidad.ts
```

Corpus: the five `demo/*/data.json` animations from the official lottie-web
repo (github.com/airbnb/lottie-web, MIT), fetched 2026-07-10 — provenance and a
feature census in [`data/README.md`](./data/README.md). Features the real
corpus doesn't exercise (gradients, repeaters, polystar, text layers, isolated
eased keyframes) are covered by authored minimal fixtures in [`fixtures/`](./fixtures/).

## Scorecard — 5/5 rendered & frame-verified

| # | Demo | Source | Proves |
|---|------|--------|--------|
| 01 | bodymovin | 1820×275 wordmark | TRIM paths (letters draw on as animated strokes), precomps, masks, nulls |
| 02 | gatin | 800×800 shapes | heavily keyframed shape layers, groups, nulls, solids (no warnings) |
| 03 | happy2016 | 1920×1080 card | precomp-heavy — 2 root layers into nested comps with masks + shape layers |
| 04 | adrock | 690×913 portrait | masks, solids, precomps, nulls; `speed` multiplier (2× demo-length choice) |
| 05 | **navidad** | 1920×1080 scene | **track mattes (`tt` alpha)** + masks, solids, precomps — the compositing stress test |

## The player (all library, campaign 5)

`loadLottie(json, {width, loop, speed})` → `LottieMobject` with `setTime(t)` /
`setFrame(f)` (pure, scrub-safe, any call order), `attachTo(scene)` (clock
updater), `layers()` / `layer(name)`, and `warnings`. Masks and track mattes
compile to `CompositeGroup` destination-in/out siblings; precomps instantiate
their referenced comp's layers once (stable containers, geometry rebuilt per
frame).

The pre-existing static single-frame importer in `src/interchange/lottie.ts`
was renamed `loadLottie → loadLottieShapes`; the new player owns `loadLottie`.

Fix this campaign contributed to the **shared renderer** (every CompositeGroup
consumer — mattes, masks, blend-mode compositing, ZoomedScene): `drawCompositeGroup`
now borrows full-frame offscreen canvases from a depth-bounded **pool** and
reuses them across frames, instead of allocating a fresh native (`@napi-rs/canvas`
Skia) surface per group per frame. A matte-heavy frame issues ~150 composite
draws; the old allocate-per-draw path grew RSS ~half a GB/frame (native memory
invisible to V8, so GC never ran) and OOM-killed navidad after ~14 frames. RSS
is now flat.

## Honest divergences

- Luma track mattes (`tt: 3/4`) are approximated as alpha mattes (warned).
- Merge paths (`mm`) are unsupported — paths render unmerged (warned).
- Gradients, repeaters, polystar and text layers are exercised only by the
  authored fixtures, not the five real files; image layers (`ty: 2`) are skipped.
- Playback drives one internal clock; expression-driven properties are out of scope.

# Auto-matching · presenter · diagram-as-code

Phase-4 adoption additions.

## Automatic shared-element matching

Author two states; the engine pairs pieces by **identity** and tweens the delta
(unlike `TransformMatchingShapes`, it keys on identity, not position — so a moved
element still matches).

```js
import { TransformMatchingAuto } from "manim-js";
circle.matchId = "hero"; bigCircle.matchId = "hero";   // explicit id (best)
await scene.play(new TransformMatchingAuto(stateA, stateB));
```

Match priority per piece: `matchId` → `text` → shape signature (type + point
count + size). Unmatched source pieces fade out; unmatched target pieces fade in.

## Presenter mode + player controls

```js
player.presenterMode = true;          // pause (or loop) at each section boundary
player.setPlaybackRate(1.5);
player.seekToSection("proof");
player.nextSection(); player.prevSection();
```

`<manim-player presenter playback-rate="1.5" volume="0.8">` enables keyboard
navigation: **space/k** play-pause, **←/→** prev/next section, **f** fullscreen,
**Home** to the start. Sections come from `nextSection()`; `SectionType.LOOP`
sections loop until you advance.

## Diagram-as-code

```js
import { diagram, parseDiagram, buildBoard, TransformMatchingAuto } from "manim-js";

const board = diagram(`
  A[Start]
  A --> B
  B -- yes --> C
`); // parse + layered layout + build a board (VGroup of nodes + edges)
scene.add(board);

// Animated board transition: re-layout, then morph via auto-matching.
const ring = buildBoard(parseDiagram("A --> B\nB --> C\nC --> A"), { algorithm: "circular" });
await scene.play(new TransformMatchingAuto(board, ring));
```

DSL: `A`, `A[Label]`, `A --> B`, `A -- label --> B` (blank/`//` lines ignored).
`layoutDiagram` supports `"layered"` (default) and `"circular"`; nodes/edges are
tagged with `matchId` (`node:A`, `edge:A->B`) so transitions pair them
automatically. See `examples/diagram.ts`.

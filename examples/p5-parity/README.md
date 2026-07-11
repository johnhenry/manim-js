# p5.js parity suite

**Generative art, deterministically.** 12 p5.js gallery patterns —
flocking, cellular automata, fractals, springs, noise fields — recreated as
reproducible ecmanim videos. Every simulation is a **pure function of a
seed + a fixed timestep**: re-rendering the same demo always produces
byte-identical output (the partial-movie cache's own requirement), unlike
the originals' live-mouse/`Math.random()`-driven interactivity.

```bash
ECMANIM_DEMO_QUALITY=low npx tsx examples/p5-parity/03-flocking-boids.ts
npm run demos:p5   # everything
```

Corpus: verbatim p5.js gallery sketch sources (LGPL), fetched live from
`raw.githubusercontent.com/processing/p5.js-website`, in
[`ref/`](./ref/) — provenance + 4 documented substitutions (no exact
official example existed for "flow field" / "10 PRINT maze" / "wave
interference" / "3D Perlin terrain") in [`ref/README.md`](./ref/README.md).

## Scorecard — 12/12 rendered & frame-verified

| # | Demo | Proves | Note |
|---|------|--------|------|
| 01 | noise-field-flow | `simplex3D`-driven pulsing dot field | animated over time (the ref itself only redraws on drag) |
| 02 | particle-system | `ParticleSystem` (pre-existing) matches a gravity+fade emitter directly | closed-form, no gap-fill needed |
| 03 | flocking-boids | **`BoidsFlock`** — Reynolds sep/align/cohesion, visible organized clustering emerging from scatter | |
| 04 | fractal-tree | literal recursive branch-point generation, angle swept via `Transform` | ref drives angle from live mouseX; swept over scene time instead |
| 05 | l-system | the pre-existing `lsystem()` generator, exact ref axiom/rules/angle | confirmed: no bracket branching needed for this specific L-system |
| 06 | game-of-life | **`CellularAutomaton`** — seeded random init, Conway's B3/S23, toroidal wrap | |
| 07 | ten-print-maze | Wolfram Rule 90 (hand-decoded from the ref's ruleset array) rendered as accumulated generation history | substitutes the ref's actual 1D CA for a literal diagonal maze |
| 08 | wave-interference | two-source `sin(k·r-ωt)` interference, sharp hyperbolic nodal fringes | composed directly — `waves.ts` is 1D waveforms, not a 2D field |
| 09 | recursive-circles | literal 1-axis recursive circle subdivision | the ref has no y-offset — one line of circles, not concentric rings |
| 10 | softbody-spring | **`SoftBody`** — Hooke's-law chase of a scripted (not live-mouse) target | |
| 11 | perlin-terrain | 3D `Surface` sampling `fbm(simplex2D)` height, rotating camera | ref is a 2D silhouette; went fuller-3D as the more faithful "Perlin terrain" |
| 12 | lerp-color-gradient | `Color.lerp` swept across animated stripes | |

## The gap-fill (this campaign's library additions)

Personal API smoke-testing (grep-verified — same faster-than-fan-out
approach as the GSAP campaign) found most patterns already reproducible:
`lsystem()`/`hilbertCurve` (Campaign 3), `noise.ts`'s
`mulberry32`/`valueNoise1D`/`simplex2D`/`simplex3D`/`fbm`, `ParticleSystem`,
`physics/waves.ts`'s `LinearWave`/`StandingWave`. Three real gaps — all
sharing the SAME determinism policy this campaign's roadmap entry names
explicitly ("fixed-step seeded stepping... deterministic via fixed dt +
seed, not closed-form"):

- **`BoidsSimulation`** (`src/layout/boids.ts`, mirrors `ForceSimulation`'s
  placement) + **`BoidsFlock`** (`src/mobject/boids.ts`) — Reynolds
  separation/alignment/cohesion, `mulberry32`-seeded init.
- **`CellularAutomaton`** (`src/mobject/cellular_automaton.ts`) — Conway's
  B3/S23 or a custom neighbor rule, toroidal or bounded, seeded random init
  or a direct grid override. Renders all alive cells as disjoint rectangle
  subpaths in ONE VMobject (one `fill()` per generation) rather than one
  mobject per cell.
- **`SoftBodySimulation`** + **`SoftBody`** (`src/mobject/soft_body.ts`) —
  N nodes on a circle, Hooke's-law spring toward a *scripted* target path
  (the ref's live-mouse chase has no deterministic equivalent).

Every gap-fill mobject's determinism is pinned by a dedicated test: same
seed + same input sequence → byte-identical output at every step.

## Bugs found & fixed

- **`CellularAutomaton`'s 1D neighbor count.** For `rows:1` (the class's own
  documented "1D elementary CA via a custom rule" use case), the toroidal
  `dr` wrap collapsed all three `dr` offsets onto the same row, so the
  left/right neighbors were each counted 3x and the cell's own state 2x
  (`neighbors = 3*left + 2*me + 3*right`) instead of the true `{left,
  right}` pair. Shipped unnoticed because Wolfram Rule 90 happens to be
  left/right-symmetric enough to still look right by coincidence — found
  while porting 07-ten-print-maze, fixed with a Rule-90-vs-independently-
  computed-XOR regression test (which fails hard against the old count,
  since it can never equal exactly 1 for boolean neighbors).

## Honest divergences

- All live-mouse-driven originals (boids' click-to-add, softbody's chase
  target, fractal-tree's branch angle) are reproduced with a scripted/
  seeded/scene-time-driven equivalent — mouse position isn't reproducible.
- `SoftBodySimulation`'s pairwise node-spread mathematically decays toward
  a point over long runtimes regardless of tuning (every node shares the
  same target, so the Hooke's-law *difference* between any two nodes is a
  target-independent homogeneous recurrence with decay rate `sqrt(damping)`
  per step) — documented in the mobject's source, not a bug.
- A pre-existing, cross-campaign caching footgun recurred twice independently
  this campaign: `Scene.wait()`'s partial-cache fingerprint doesn't capture
  updater-closure-captured simulation parameters (e.g. tuning `springing`/
  `perceptionRadius` mid-iteration can silently reuse a stale cached
  segment) — known since the Remotion-era campaigns, worked around by
  clearing `out/partial/`, not touched here (deep caching-architecture
  change, out of this campaign's scope).

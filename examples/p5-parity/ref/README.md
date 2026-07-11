# p5.js generative reference corpus

12 examples fetched verbatim from the official p5.js examples corpus
(**LGPL-2.1**, same license as the p5.js library itself — p5.js's core
`package.json` declares `"license": "LGPL-2.1"`; the `p5.js-website` repo
that hosts the rendered examples site is MIT-licensed for its own Astro/site
tooling, but the example *sketches* themselves are p5.js's official example
code, several explicitly credited inline to Daniel Shiffman / natureofcode.com
or other named contributors), fetched 2026-07-10/11 from
`raw.githubusercontent.com/processing/p5.js-website/main/src/content/examples/en/...`
— the live source tree behind [p5js.org/examples](https://p5js.org/examples/)
(one substitution, noted below, comes from `processing/p5.js` itself, the
core library repo, also LGPL-2.1). These are the actual `setup()`/`draw()`
sketch files (plus any helper classes/functions in the same file), not
rendered canvas/HTML output — most examples ship as a single `code.js`;
where the canonical example lives in the site's `More/` folder (older,
supplementary sketches not promoted to a numbered top-level slot) that file
is cited directly, since it's still the current, actively-maintained source.

The current p5.js examples site (a 2024 Astro rewrite, curated to ~60
examples) does not carry titled entries for every pattern this campaign
targets — no gallery entry is titled "10 PRINT" / "maze", "wave
interference", "recursive circles", or "terrain". Per this campaign's
substitution rule, each of those was matched to the closest official p5.js
sketch by algorithmic/visual intent rather than fabricated; every
substitution is called out in the table below with the reasoning.

| # | Example | Proves | License | Source |
|---|---------|--------|---------|--------|
| 01 | [noise field flow](./01-noise-field-flow.js) — "Noise" (substitution: no example titled "flow field" exists in the official corpus; this is the gallery's own canonical Perlin-noise example — a 2D field of noise-driven values sampled per grid cell, the closest official analog to a noise-driven field) | Perlin `noise()` sampled per-cell across a dot grid, sized by the sampled value, with slider-controlled gap/offset | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/07_Repetition/04_Noise/code.js |
| 02 | [particle system](./02-particle-system.js) — "Particle System" | a `Particle`/`ParticleSystem` class pair emitting short-lived, gravity-accelerated particles from a fixed origin, fading out and self-removing (Nature of Code / Daniel Shiffman, credited inline) | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/15_Math_And_Physics/More/ParticleSystem.js |
| 03 | [flocking / boids](./03-flocking-boids.js) — "Flocking" | Craig Reynolds' separation/alignment/cohesion boid rules, each boid a steering-force-limited `p5.Vector` agent, mouse-drag spawns new boids | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/13_Classes_And_Objects/03_Flocking/code.js |
| 04 | [fractal tree](./04-fractal-tree.js) — "Recursive Tree" | recursive `branch()` function drawing a binary branching tree, angle driven by mouse X, hue shifting per recursion depth | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/07_Repetition/05_Recursive_Tree/code.js |
| 05 | [L-system](./05-l-system.js) — "L-Systems" | Lindenmayer-system string rewriting (axiom `A`, two production rules) interpreted by a turtle-graphics `drawIt()` walker into a branching grid pattern (by R. Luke DuBois) | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/15_Math_And_Physics/More/LSystems.js |
| 06 | [Conway's Game of Life](./06-game-of-life.js) — "Game Of Life" | classic 2-state cellular automaton on a wrapped (toroidal) grid, birth/survival/death rules, click to reseed randomly | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/15_Math_And_Physics/04_Game_Of_Life/code.js |
| 07 | [ten print maze](./07-ten-print-maze.js) — "Wolfram CA" (substitution: no "10 PRINT" / diagonal-maze example exists in the official corpus; this is the closest official analog in spirit — a minimal per-cell rule table, evaluated across a fixed-width row grid each generation, producing a dense emergent maze-like texture down the canvas) | 1-dimensional elementary cellular automaton (Wolfram rule table applied to each cell's `{left, me, right}` neighborhood), rendered as a growing grid of black/white cells (Nature of Code, credited inline) | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/15_Math_And_Physics/More/WolframCA.js |
| 08 | [wave interference](./08-wave-interference.js) — "Wavemaker" (substitution: no example titled "wave interference" exists in the official corpus; Wavemaker is the closest official analog — its own description states it shows "how waves...emerge from particles oscillating in place," combining an x-direction and a y-direction angular wave into one per-particle phase, i.e. two wave sources superposed) | a grid of particles each orbiting in a circle whose phase is the sum of a mouse-driven x-wave and y-wave term — two oscillation sources superposed per particle (by Aatish Bhatia, credited inline) | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/07_Repetition/More/Wavemaker.js |
| 09 | [recursive circles](./09-recursive-circles.js) — "Recursion" (substitution: the site's "Recursion" example is not filed under a generative/simulate category, but it is literally a recursive circle-drawing function — the closest and most direct official match to "recursive circles" of anything in the corpus) | `drawCircle()` recursively draws two half-radius child circles across the horizontal midpoint of each parent circle until a terminating radius is hit | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/07_Repetition/More/Recursion.js |
| 10 | [softbody / spring simulation](./10-softbody-spring.js) — "Soft Body" | a 5-node polygon whose vertices oscillate with independent sine-wave frequencies while the whole shape springs (damped acceleration) toward the mouse, `splineVertex`/`splineProperty` giving it organic, soft-edged motion | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/15_Math_And_Physics/01_Soft_Body/code.js |
| 11 | [Perlin terrain](./11-perlin-terrain.js) — `noise()` reference example, "A hilly terrain..." (substitution: no 3D WEBGL terrain-mesh example exists anywhere in the official p5.js examples corpus, confirmed by search; this is instead one of the `js example` code blocks embedded directly in the JSDoc of `noise()` itself, in the **p5.js core library repo** — its own `describe()` call names it a "hilly terrain," making it the one official, first-party artifact that explicitly claims to depict terrain via noise) | `noise()` sampled along a scrolling x-coordinate to draw a vertical-line skyline silhouette — a 2D terrain profile, not a 3D mesh; noted honestly since the campaign brief asks for "3D surface" | LGPL-2.1 | https://github.com/processing/p5.js/blob/main/src/math/noise.js (inline `@example` block on the `noise()` function doc comment) |
| 12 | [lerp color gradient](./12-lerp-color-gradient.js) — "Color Interpolation" | `lerpColor()` swept across 12 horizontal stripes between a top and bottom HSB color, with "Color A"/"Color B" end-cap labels | LGPL-2.1 | https://github.com/processing/p5.js-website/blob/main/src/content/examples/en/07_Repetition/00_Color_Interpolation/code.js |

**Substitution summary** (4 of 12; all algorithmic/visual-intent matches per
the campaign's stated substitution rule, none fabricated): #01 noise field
flow → "Noise" (no dedicated flow-field gallery example exists); #07 ten
print maze → "Wolfram CA" (no diagonal-line-maze example exists; closest
official minimal-rule emergent-grid-texture generator); #08 wave
interference → "Wavemaker" (no example literally titled interference
exists; Wavemaker's own description is the closest official match — two
superposed oscillation sources per particle); #11 Perlin terrain → the
`noise()` reference doc's own "hilly terrain" example, pulled from the core
`p5.js` library repo rather than the examples site, since no 3D terrain
mesh example exists anywhere in the official corpus (this one is a 2D
terrain silhouette, not a 3D surface — documented gap, not a full match).

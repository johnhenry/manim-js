// Reveal.js/Slidev parity demo 01: a markdown-authored deck driving
// deckFromMarkdown() (src/loaders/deck_markdown.ts, this campaign's
// gap-fill) end to end. Covers: headings/`---` slide separators (matching
// both reveal-demo.html's <section> boundaries and slidev-demo.md's `---`
// convention — see ref/), incremental bullet lists (Slidev's `v-click`,
// reveal.js's fragment lists — ref/slidev-demo.md's "Navigation" slide and
// ref/reveal-demo.html's fragment sections), a math slide ($$...$$, KaTeX in
// the real decks — ref/slidev-demo.md has one), and speaker notes (both
// decks' own convention — ref/reveal-demo.html's <aside class="notes">,
// ref/slidev-demo.md's trailing HTML comment; deckFromMarkdown supports
// BOTH forms, carried through to Scene.nextSection()'s notes param, which
// already existed before this campaign).
//
// Content is original prose about ecmanim itself (matching examples/
// voiceover.ts's self-referential convention), not literal text lifted from
// the corpus decks (which are framework-specific Vue/HTML, not portable
// markdown — see src/loaders/deck_markdown.ts's header for why).

import { initMathTex } from "../../src/node.ts";
import { deckFromMarkdown } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const deck = `
# ecmanim

A code-driven animation engine that renders the same Scene to Node video
and a live browser canvas.

<!-- Open on the title slide. Let it breathe for a second before advancing. -->

---

# What it can do

- Vector shapes, text, and LaTeX as true Bezier paths
- 2D and 3D scenes on one Canvas renderer
- Headless video output via ffmpeg, no browser required
- The exact same Scene code runs live in a \`<canvas>\`

<aside class="notes">
Each bullet should land with a beat — this is the incremental-list pattern
both Reveal.js fragments and Slidev's v-click cover.
</aside>

---

# The math checks out

$$\\int_0^{2\\pi} e^{i\\theta}\\,d\\theta = 0$$

<!-- A one-line pause on the identity is enough; no need to explain it here. -->
`;

await initMathTex();
await demoRender(deckFromMarkdown(deck, { holdTime: 0.6, fragmentRunTime: 0.35 }), import.meta.url);

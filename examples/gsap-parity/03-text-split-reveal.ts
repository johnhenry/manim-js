// GSAP parity demo 03: ref/03-text-split-reveal.md — the SplitText pattern
// (gsap.com/docs/v3/Plugins/SplitText): a text node decomposed into
// individually-positioned per-character/word elements, then revealed with a
// stagger so the line appears to "rise into place" rather than fading in as
// one block. Uses Text.words()/Text.chars (src/mobject/text/Text.ts, added
// this campaign -- see test/text-split.test.ts) + LaggedStartMap for the
// staggered entrance.
//
// Per-glyph mobjects are NOT pre-added to the scene: each FadeIn is an
// "introducer" animation (Animation.ts's `introducer` flag), so
// Scene.play adds every glyph/word mobject to the scene the moment its own
// staggered FadeIn begins (same pattern as coverage-animations.ts's
// `LaggedStartMap((m) => new Create(m), dots, ...)` -- mobjects are never
// pre-added via this.add()). A positive `shift` on FadeIn starts the glyph
// BELOW its final baseline (see Animation.ts's FadeIn: start = final -
// shiftVec) so it rises up into place while fading in -- the classic
// SplitText "type on" look.

import { Scene, Text, LaggedStartMap, FadeIn, FadeOut, WHITE } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class TextSplitReveal extends Scene {
  async construct() {
    // --- Phase 1: word-level split -- "GSAP patterns" reveals word by word. ---
    const caption1 = new Text("split: words", { fontSize: 0.32, color: WHITE, point: [0, 3.3, 0] });
    await this.play(new FadeIn(caption1), { _playConfig: true, runTime: 0.4 });

    const phrase1 = new Text("GSAP patterns", { fontSize: 1.0, color: WHITE });
    phrase1.moveTo([0, 0.3, 0]);
    const words = phrase1.words();
    await this.play(
      new LaggedStartMap(
        (m: any) => new FadeIn(m, { shift: [0, 0.6, 0], runTime: 0.6 }),
        words,
        { lagRatio: 0.5 },
      ),
    );
    await this.wait(0.6);

    await this.play(
      new FadeOut(caption1),
      ...words.map((w) => new FadeOut(w, { runTime: 0.4 })),
      { _playConfig: true, runTime: 0.4 },
    );

    // --- Phase 2: char-level split -- "ecmanim" reveals letter by letter. ---
    const caption2 = new Text("split: chars", { fontSize: 0.32, color: WHITE, point: [0, 3.3, 0] });
    await this.play(new FadeIn(caption2), { _playConfig: true, runTime: 0.4 });

    const phrase2 = new Text("ecmanim", { fontSize: 1.4, color: WHITE });
    phrase2.moveTo([0, 0, 0]);
    const chars = phrase2.chars.submobjects;
    await this.play(
      new LaggedStartMap(
        (m: any) => new FadeIn(m, { shift: [0, 0.4, 0], runTime: 0.5 }),
        chars,
        { lagRatio: 0.18 },
      ),
    );
    await this.wait(0.8);

    await this.play(
      new FadeOut(caption2),
      ...chars.map((c: any) => new FadeOut(c, { runTime: 0.4 })),
      { _playConfig: true, runTime: 0.4 },
    );
  }
}

await demoRender(TextSplitReveal, import.meta.url);

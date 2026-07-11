// GSAP parity demo 04: ref/04-shape-morph.md — SVG shape morph (MorphSVG
// pattern, gsap.com/docs/v3/Plugins/MorphSVGPlugin). MorphSVG animates a
// path's `d` attribute so it continuously deforms into a second, visually
// distinct shape, reconciling mismatched point counts automatically. We
// recreate the *pattern* -- one filled shape's outline smoothly deforming
// into another's, not a cross-fade -- with TransformMatchingShapes
// (src/animation/transform_matching.ts). A plain Star and Circle have no
// submobjects, so TransformMatchingShapes's shape-key matcher sees a single
// piece on each side with mismatched keys (different point count/bbox);
// `transformMismatches: true` tells it to Transform that unmatched-source
// piece into the unmatched-target piece by position instead of fading it
// (manim's transform_mismatches), which routes through Animation.ts's
// Transform -- whose setup() aligns point counts (alignPointsWith) so every
// point genuinely travels from source shape to target shape. That's the
// actual continuous-deformation morph MorphSVG demonstrates.
//
// Two morphs in sequence make the effect legible across transitions:
// Star -> Circle -> Square.

import { Scene, Star, Circle, Square, TransformMatchingShapes, YELLOW, TEAL, PINK } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class ShapeMorph extends Scene {
  async construct() {
    const star = new Star(5, { outerRadius: 1.7, innerRadius: 0.65, color: YELLOW, fillOpacity: 1, strokeWidth: 0 });
    star.moveTo([0, 0, 0]);
    this.add(star);
    await this.wait(0.6);

    const circle = new Circle({ radius: 1.6, color: TEAL, fillOpacity: 1, strokeWidth: 0 });
    circle.moveTo([0, 0, 0]);
    await this.play(new TransformMatchingShapes(star, circle, { transformMismatches: true, runTime: 1.6 }));
    // Settle scene membership post-morph (matches the TransformMatchingTex
    // convention in examples/threeb1b-parity/04-sum-of-odds.ts): drop the
    // morphed source, keep the target.
    this.remove(star);
    this.add(circle);
    await this.wait(0.6);

    const square = new Square({ sideLength: 2.7, color: PINK, fillOpacity: 1, strokeWidth: 0 });
    square.moveTo([0, 0, 0]);
    await this.play(new TransformMatchingShapes(circle, square, { transformMismatches: true, runTime: 1.6 }));
    this.remove(circle);
    this.add(square);
    await this.wait(0.6);
  }
}

await demoRender(ShapeMorph, import.meta.url);

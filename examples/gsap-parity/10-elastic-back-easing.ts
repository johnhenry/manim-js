// GSAP parity demo 10: ref/10-elastic-back-easing.md — elastic vs back
// easing (GSAP docs, gsap.com/docs/v3/Eases/). The SAME move tween (shift
// the same distance over the same duration) plays twice, once per row, so
// the two eases' overshoot/bounce character is directly comparable:
//   - top row:    "elastic.out(1, 0.3)" -> easeOutElasticFactory(1, 0.3)
//     oscillates past the target several times before settling.
//   - bottom row: "back.out(1.7)"       -> easeOutBackFactory(1.7)
//     overshoots ONCE past the target, then eases back to rest.
// Rate-function names/factories confirmed by grepping src/plugins/builtins.ts
// (registry.registerRateFunctionFactory("elasticOut"/"backOut", ...)) and
// the underlying plain exports in src/animation/rate_functions.ts
// (easeOutElasticFactory, easeOutBackFactory — GSAP-parameterized, default
// args collapse to the same curve as the plain easeOutElastic/easeOutBack).

import {
  Scene, Square, Text, Transform,
} from "../../src/node.ts";
import { easeOutElasticFactory, easeOutBackFactory } from "../../src/animation/rate_functions.ts";
import { demoRender } from "./_run.ts";

const DISTANCE = 8; // same horizontal travel for both rows
const DURATION = 2; // same duration for both rows

class ElasticBackEasing extends Scene {
  async construct() {
    const elasticLabel = new Text("elastic.out(1, 0.3)", { fontSize: 0.5, color: "#48dbfb" });
    elasticLabel.moveTo([0, 2.4, 0]);
    const backLabel = new Text("back.out(1.7)", { fontSize: 0.5, color: "#ff6b6b" });
    backLabel.moveTo([0, -1.1, 0]);
    this.add(elasticLabel, backLabel);

    const elasticSq = new Square({ sideLength: 0.9, color: "#48dbfb", fillOpacity: 1 });
    elasticSq.moveTo([-5.5, 1.4, 0]);
    const backSq = new Square({ sideLength: 0.9, color: "#ff6b6b", fillOpacity: 1 });
    backSq.moveTo([-5.5, -2.1, 0]);
    this.add(elasticSq, backSq);

    // Reference guide lines at each row's target x, so overshoot is legible
    // against a fixed mark rather than just "did it stop moving".
    const guideY1 = new Square({ sideLength: 0.05, color: "#666666", fillOpacity: 1 });
    guideY1.moveTo([-5.5 + DISTANCE, 1.4, 0]);
    const guideY2 = new Square({ sideLength: 0.05, color: "#666666", fillOpacity: 1 });
    guideY2.moveTo([-5.5 + DISTANCE, -2.1, 0]);
    this.add(guideY1, guideY2);

    const elasticTarget = elasticSq.copy();
    elasticTarget.moveTo([-5.5 + DISTANCE, 1.4, 0]);
    const backTarget = backSq.copy();
    backTarget.moveTo([-5.5 + DISTANCE, -2.1, 0]);

    const elasticTween = new Transform(elasticSq, elasticTarget, {
      runTime: DURATION,
      rateFunc: easeOutElasticFactory(1, 0.3),
    });
    const backTween = new Transform(backSq, backTarget, {
      runTime: DURATION,
      rateFunc: easeOutBackFactory(1.7),
    });

    // Same tween, same duration, two eases: play them together so the
    // difference in overshoot/oscillation is visible frame-for-frame.
    await this.play(elasticTween, backTween);
    await this.wait(1);
  }
}

await demoRender(ElasticBackEasing, import.meta.url);

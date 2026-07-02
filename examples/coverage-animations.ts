// Coverage sweep: exercises registered animations that had zero usage anywhere
// in examples/ or test/ before this file (found via a registry audit). Grouped
// into sections played in sequence. Several of these have non-obvious argument
// orders (function-first, point-first, Animation-first) documented inline.
// Run: node examples/coverage-animations.ts -> examples/out/coverage-animations.mp4
import {
  render, Scene, VGroup, Text, Circle, Square, Dot, Line, ComplexPlane,
  Create, FadeIn, FadeOut, Rotate,
  AddTextWordByWord, ApplyComplexFunction, ApplyFunction, ApplyPointwiseFunction,
  ApplyPointwiseFunctionToCenter, Blink, ChangeSpeed, Circumscribe, ComplexHomotopy,
  CounterclockwiseTransform, FadeToColor, FadeTransformPieces, Flash, FocusOn,
  GrowFromPoint, LaggedStartMap, RemoveTextLetterByLetter, ReplacementTransform,
  ScaleInPlace, ShowPassingFlashWithThinningStrokeWidth, ShrinkToCenter,
  SmoothedVectorizedHomotopy, SpinInFromNothing, Succession, Swap, TypeWithCursor,
  Untype, UntypeWithCursor, Wiggle,
  BLUE, GREEN, RED, YELLOW, TEAL, PURPLE, ORANGE, WHITE,
} from "../src/node.ts";

function tag(text: string) {
  return new Text(text, { fontSize: 0.32, color: WHITE, point: [0, 3.3, 0], opacity: 0.9 });
}

class CoverageAnimations extends Scene {
  async construct() {
    // 1. Function-first animations: ApplyFunction / ApplyPointwiseFunction /
    //    ApplyPointwiseFunctionToCenter — (fn, mobject), not (mobject, fn).
    let t = tag("ApplyFunction / ApplyPointwiseFunction(ToCenter)");
    const sq1 = new Square({ sideLength: 1.4, color: BLUE }).moveTo([-4, 0, 0]);
    const sq2 = new Square({ sideLength: 1.4, color: GREEN }).moveTo([0, 0, 0]);
    const dot1 = new Dot({ color: RED }).moveTo([4, 0, 0]);
    await this.play(new FadeIn(t), new Create(sq1), new Create(sq2), new Create(dot1), { _playConfig: true, runTime: 0.6 });
    await this.play(
      new ApplyFunction((p: number[]) => [p[0], p[1] + 0.6 * Math.sin(p[0]), p[2]], sq1),
      new ApplyPointwiseFunction((p: number[]) => [p[0] * 1.3, p[1] * 0.7, p[2]], sq2),
      new ApplyPointwiseFunctionToCenter((c: number[]) => [c[0] + 1, c[1] + 0.8, c[2]], dot1),
    );
    await this.wait(0.3);
    await this.play(new FadeOut(t), new FadeOut(sq1), new FadeOut(sq2), new FadeOut(dot1), { _playConfig: true, runTime: 0.5 });

    // 2. ApplyComplexFunction / ComplexHomotopy — operate on {re,im}, need a
    //    mobject with applyComplexFunction (ComplexPlane's grid lines qualify).
    t = tag("ApplyComplexFunction / ComplexHomotopy (z -> z^2)");
    const plane = new ComplexPlane({ xRange: [-3, 3, 1], yRange: [-2, 2, 1] }).scale(0.9);
    await this.play(new FadeIn(t), new Create(plane), { _playConfig: true, runTime: 0.6 });
    await this.play(new ApplyComplexFunction((z: any) => ({ re: z.re * z.re - z.im * z.im, im: 2 * z.re * z.im }), plane, { runTime: 1.5 }));
    const plane2 = new ComplexPlane({ xRange: [-3, 3, 1], yRange: [-2, 2, 1] }).scale(0.9);
    await this.play(new FadeOut(plane), new FadeIn(plane2), { _playConfig: true, runTime: 0.4 });
    await this.play(new ComplexHomotopy((z: any, s: number) => ({ re: z.re + 0.6 * Math.sin(s * Math.PI), im: z.im }), plane2, { runTime: 1.5 }));
    await this.play(new FadeOut(t), new FadeOut(plane2), { _playConfig: true, runTime: 0.4 });

    // 3. SmoothedVectorizedHomotopy — (x,y,z,t) scalar-arg homotopy on a VMobject path.
    t = tag("SmoothedVectorizedHomotopy");
    const wave = new Line([-4, 0, 0], [4, 0, 0], { color: TEAL });
    await this.play(new FadeIn(t), new Create(wave), { _playConfig: true, runTime: 0.5 });
    await this.play(new SmoothedVectorizedHomotopy(
      (x: number, y: number, z: number, s: number) => [x, y + 0.8 * Math.sin(x + s * Math.PI * 2), z], wave,
      { runTime: 1.5 },
    ));
    await this.play(new FadeOut(t), new FadeOut(wave), { _playConfig: true, runTime: 0.4 });

    // 4. Transform-family pairs: ReplacementTransform, CounterclockwiseTransform,
    //    FadeTransformPieces, Swap.
    t = tag("ReplacementTransform / CounterclockwiseTransform / Swap");
    const a = new Circle({ radius: 0.7, color: BLUE, fillColor: BLUE, fillOpacity: 0.5 }).moveTo([-4.5, 0, 0]);
    const b = new Square({ sideLength: 1.2, color: RED, fillColor: RED, fillOpacity: 0.5 }).moveTo([-1.5, 0, 0]);
    const c1 = new Circle({ radius: 0.6, color: GREEN, fillColor: GREEN, fillOpacity: 0.5 }).moveTo([1.5, 0, 0]);
    const c2 = new Circle({ radius: 0.6, color: YELLOW, fillColor: YELLOW, fillOpacity: 0.5 }).moveTo([4, 0, 0]);
    await this.play(new FadeIn(t), new Create(a), new Create(c1), new Create(c2), { _playConfig: true, runTime: 0.6 });
    await this.play(new ReplacementTransform(a, b));
    await this.play(new CounterclockwiseTransform(b, new Square({ sideLength: 1.2, color: PURPLE, fillColor: PURPLE, fillOpacity: 0.5 }).moveTo([-1.5, 0, 0])));
    await this.play(new Swap(c1, c2));
    await this.wait(0.3);
    await this.play(new FadeOut(t), new FadeOut(b), new FadeOut(c1), new FadeOut(c2), { _playConfig: true, runTime: 0.5 });

    t = tag("FadeTransformPieces (grouped submobjects)");
    const groupA = new VGroup(new Circle({ radius: 0.4, color: BLUE }).moveTo([-1, 0, 0]), new Circle({ radius: 0.4, color: BLUE }).moveTo([1, 0, 0]));
    const groupB = new VGroup(new Square({ sideLength: 0.7, color: RED }).moveTo([-1, 1, 0]), new Square({ sideLength: 0.7, color: RED }).moveTo([1, -1, 0]));
    await this.play(new FadeIn(t), new Create(groupA), { _playConfig: true, runTime: 0.6 });
    await this.play(new FadeTransformPieces(groupA, groupB));
    await this.wait(0.3);
    await this.play(new FadeOut(t), new FadeOut(groupB), { _playConfig: true, runTime: 0.4 });

    // 5. ScaleInPlace, FadeToColor, GrowFromPoint, ChangeSpeed, Circumscribe.
    t = tag("ScaleInPlace / FadeToColor / GrowFromPoint / ChangeSpeed");
    const sq3 = new Square({ sideLength: 1, color: BLUE, fillColor: BLUE, fillOpacity: 0.5 }).moveTo([-4.5, 0, 0]);
    const sq4 = new Square({ sideLength: 1, color: GREEN }).moveTo([-1.5, 0, 0]);
    const dot2 = new Dot({ color: RED }).moveTo([2, 0, 0]);
    await this.play(new FadeIn(t), new Create(sq3), new Create(sq4), { _playConfig: true, runTime: 0.5 });
    await this.play(new ScaleInPlace(sq3, 1.6), new FadeToColor(sq4, "#FF8800"));
    await this.play(new ChangeSpeed(new GrowFromPoint(dot2, [-2, -2, 0]), { 0: 1, 0.5: 3, 1: 0.5 }));
    await this.wait(0.3);
    await this.play(new FadeOut(t), new FadeOut(sq3), new FadeOut(sq4), new FadeOut(dot2), { _playConfig: true, runTime: 0.4 });

    t = tag("Circumscribe / Flash / FocusOn (point-based)");
    const target = new Text("focus me", { fontSize: 0.6, color: WHITE }).moveTo([0, 0, 0]);
    await this.play(new FadeIn(t), new Create(target), { _playConfig: true, runTime: 0.5 });
    await this.play(new Circumscribe(target, { color: YELLOW }));
    await this.play(new Flash([0, 0, 0], { color: WHITE, numLines: 14 }));
    await this.play(new FocusOn(target, { startRadius: 2.5 }));
    await this.wait(0.3);
    await this.play(new FadeOut(t), new FadeOut(target), { _playConfig: true, runTime: 0.4 });

    // 6. Indicator/removal animations: Blink, ShrinkToCenter, Wiggle, SpinInFromNothing,
    //    ShowPassingFlashWithThinningStrokeWidth.
    t = tag("Blink / Wiggle / SpinInFromNothing / ShrinkToCenter");
    const dot3 = new Dot({ color: TEAL, radius: 0.3 }).moveTo([-4, 0, 0]);
    const sq5 = new Square({ sideLength: 1, color: ORANGE }).moveTo([-1, 0, 0]);
    await this.play(new FadeIn(t), new Create(dot3), { _playConfig: true, runTime: 0.4 });
    await this.play(new Blink(dot3, { blinks: 2, timeOn: 0.15, timeOff: 0.15 }));
    await this.play(new SpinInFromNothing(sq5, { runTime: 0.8 }));
    await this.play(new Wiggle(sq5, { nWiggles: 5 }));
    await this.play(new ShrinkToCenter(dot3), new ShrinkToCenter(sq5));

    const path = new Line([1, -1.5, 0], [4, 1.5, 0], { color: PURPLE, strokeWidth: 6 });
    await this.play(new Create(path), { _playConfig: true, runTime: 0.4 });
    await this.play(new ShowPassingFlashWithThinningStrokeWidth(path, { timeWidth: 0.25, nSegments: 12, runTime: 1.2 }));
    await this.wait(0.3);
    await this.play(new FadeOut(t), new FadeOut(path), { _playConfig: true, runTime: 0.4 });

    // 7. Text typing family: TypeWithCursor / Untype / UntypeWithCursor,
    //    AddTextWordByWord / RemoveTextLetterByLetter.
    t = tag("TypeWithCursor / Untype / AddTextWordByWord");
    const typed = new Text("type me", { fontSize: 0.6, color: WHITE }).moveTo([0, 1, 0]);
    await this.play(new FadeIn(t), { _playConfig: true, runTime: 0.3 });
    await this.play(new TypeWithCursor(typed, undefined, { timePerChar: 0.06 }));
    await this.wait(0.3);
    await this.play(new UntypeWithCursor(typed, undefined, { timePerChar: 0.04 }));

    const worded = new Text("word by word reveal", { fontSize: 0.5, color: WHITE }).moveTo([0, 0, 0]);
    await this.play(new AddTextWordByWord(worded, { timePerChar: 0.03 }));
    await this.wait(0.3);
    await this.play(new RemoveTextLetterByLetter(worded, { timePerChar: 0.02 }));
    await this.wait(0.2);
    await this.play(new FadeOut(t), { _playConfig: true, runTime: 0.3 });

    // 8. Succession (array of prebuilt Animations) / LaggedStartMap (factory + mobject array).
    t = tag("Succession / LaggedStartMap");
    const dots = [-3, -1.5, 0, 1.5, 3].map((x) => new Dot({ color: BLUE, radius: 0.25 }).moveTo([x, 0, 0]));
    await this.play(new FadeIn(t), { _playConfig: true, runTime: 0.3 });
    await this.play(new LaggedStartMap((m: any) => new Create(m), dots, { lagRatio: 0.3 }));
    const puck = new Dot({ color: RED, radius: 0.3 }).moveTo([-3, -1.5, 0]);
    await this.play(new Succession([
      new FadeIn(puck),
      new Rotate(puck, Math.PI),
      new FadeOut(puck),
    ]));
    await this.wait(0.3);
    await this.play(new FadeOut(t), ...dots.map((d) => new FadeOut(d)), { _playConfig: true, runTime: 0.4 });
  }
}

await render(CoverageAnimations, {
  output: "examples/out/coverage-animations.mp4",
  quality: "medium",
  background: "#0d1117",
});
console.log("coverage-animations.ts done");

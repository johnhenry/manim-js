import {
  MovingCameraScene, Axes, DecimalNumber, Dot, Text, Write, Create, FadeIn, Indicate,
  bindTrack, defineSchema, WHITE, YELLOW,
} from "ecmanim/browser";

const FUNCS = {
  quadratic: { fn: (x) => 0.35 * x * x - 1.5, label: "f(x) = 0.35x² − 1.5" },
  sine: { fn: (x) => 1.8 * Math.sin(x), label: "f(x) = 1.8·sin(x)" },
  cubic: { fn: (x) => 0.08 * x * x * x, label: "f(x) = 0.08x³" },
};

export default class FunctionExplorerScene extends MovingCameraScene {
  static schema = defineSchema({
    curve: { type: "enum", values: ["quadratic", "sine", "cubic"], default: "quadratic" },
    accent: { type: "color", default: "#58C4DD" },
    focusX: { type: "number", min: -4, max: 4, default: 2 },
  });

  constructor(config = {}) {
    super(config);
    this.props = config.props ?? FunctionExplorerScene.schema.parse({});
  }

  async construct() {
    const { fn, label } = FUNCS[this.props.curve];
    const accent = this.props.accent;

    // Capture the scene's actual native frame size (whatever aspect ratio
    // Studio/quality preset is using) so "wide" always returns to it exactly
    // -- specifying only one of width/height here (and relying on "focus"'s
    // zoom to restore it) would leave the OTHER dimension at whatever a
    // previous stop left it at, distorting circles into ellipses.
    const nativeWidth = this.camera.frameWidth;
    const nativeHeight = this.camera.frameHeight;
    this.defineCameraStop("wide", { center: [0, 0, 0], width: nativeWidth, height: nativeHeight });
    // zoom alone scales width/height together, so it can never desync them.
    this.defineCameraStop("focus", { center: [this.props.focusX, fn(this.props.focusX), 0], zoom: 3 });

    // --- Section 1: title ---------------------------------------------------
    this.nextSection("intro");
    const title = new Text(label, { fontSize: 0.8, color: YELLOW, point: [0, 3, 0] });
    await this.play(new Write(title));
    await this.wait(0.3);

    // --- Section 2: plot the curve, wide view -------------------------------
    this.nextSection("plot");
    await this.goToCameraStop("wide", { runTime: 0.8 });
    const axes = new Axes({ xRange: [-4, 4, 1], yRange: [-4, 4, 1] });
    const curve = axes.plot(fn, { color: accent });
    await this.play(new Create(axes));
    await this.play(new Create(curve));
    await this.play(title.animate.scale(0.01));
    await this.wait(0.3);

    // --- Section 3: zoom in on a marked point, live readout, keyframe pulse -
    this.nextSection("focus");
    const focusPoint = axes.coordsToPoint(this.props.focusX, fn(this.props.focusX));
    const marker = new Dot({ point: focusPoint, color: WHITE, radius: 0.08 });
    await this.play(new Create(marker));
    await this.goToCameraStop("focus", { runTime: 1.2 });

    const readout = new DecimalNumber(fn(this.props.focusX), {
      numDecimalPlaces: 2,
      color: WHITE,
      fontSize: 0.35,
      point: [this.props.focusX + 0.6, fn(this.props.focusX) + 0.6, 0],
    });
    await this.play(new FadeIn(readout));

    // A property-keyframe track pulsing the marker's radius -- driven purely
    // by scene time, via bindTrack()'s ordinary updater mechanism.
    const pulse = this.track([
      { t: 0, value: 0.08 },
      { t: 0.6, value: 0.16, ease: "easeInOutSine" },
      { t: 1.2, value: 0.08, ease: "easeInOutSine" },
    ]);
    const basePoint = focusPoint;
    bindTrack(marker, "radius", pulse);
    marker.addUpdater((m) => {
      const r = m.radius;
      m.points = new Dot({ point: basePoint, radius: r }).points;
    });

    await this.play(new Indicate(marker, { color: accent }));
    await this.wait(1.2);

    // --- Section 4: back to the wide view ------------------------------------
    this.nextSection("wide-again");
    await this.goToCameraStop("wide", { runTime: 1 });
    await this.wait(0.5);
  }
}

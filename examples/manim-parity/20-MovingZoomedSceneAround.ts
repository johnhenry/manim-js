// Port of Manim CE gallery: MovingZoomedSceneAround
// (ref/MovingZoomedSceneAround.py) — the FULL ZoomedScene workflow rebuilt in
// the parity pass: live zoom window, pop-out animation, UpdateFromFunc,
// foreground mobjects, pixel-array image, vector scale.

import {
  ZoomedScene, Dot, ImageMobject, Text, BackgroundRectangle, Create, FadeIn,
  FadeOut, Uncreate, ScaleInPlace, UpdateFromFunc, imageFromArray, fontSizePt,
  PURPLE, RED, UL, UP, DOWN, MED_SMALL_BUFF, rate_functions,
} from "../../src/node.ts";
import * as V from "../../src/core/math/vector.ts";
import { demoRender } from "./_run.ts";

const pixelBitmap = await imageFromArray([
  [0, 100, 30, 200],
  [255, 0, 5, 33],
]);

class MovingZoomedSceneAround extends ZoomedScene {
  constructor(config: any = {}) {
    super({
      zoomFactor: 0.3,
      zoomedDisplayHeight: 1,
      zoomedDisplayWidth: 6,
      imageFrameStroke: 20,
      zoomedCameraConfig: { defaultFrameStrokeWidth: 3 },
      ...config,
    });
  }

  async construct() {
    const dot = new Dot().shift(V.scale(UL, 2));
    const image = new ImageMobject(pixelBitmap, { height: 7 });
    const frameText = new Text("Frame", { color: PURPLE, fontSize: fontSizePt(67) });
    const zoomedCameraText = new Text("Zoomed camera", { color: RED, fontSize: fontSizePt(67) });

    this.add(image, dot);
    const zoomedCamera = this.zoomedCamera;
    const zoomedDisplay = this.zoomedDisplay;
    const frame = zoomedCamera.frame;
    const zoomedDisplayFrame = zoomedDisplay.displayFrame;

    frame.moveTo(dot.getCenter());
    frame.setColor(PURPLE);
    zoomedDisplayFrame.setColor(RED);
    zoomedDisplay.shift(DOWN);

    const zdRect = new BackgroundRectangle(zoomedDisplay, { fillOpacity: 0, buff: MED_SMALL_BUFF });
    this.addForegroundMobject(zdRect);

    const unfoldCamera = () => new UpdateFromFunc(zdRect, (rect: any) => rect.replace(zoomedDisplay, { stretch: true }));

    frameText.nextTo(frame, DOWN);

    await this.play(new Create(frame), new FadeIn(frameText, { shift: UP }));
    await this.activateZooming();

    await this.play(this.getZoomedDisplayPopOutAnimation(), unfoldCamera());
    zoomedCameraText.nextTo(zoomedDisplayFrame, DOWN);
    await this.play(new FadeIn(zoomedCameraText, { shift: UP }));
    // Scale in        x    y   z
    const scaleFactor = [0.5, 1.5, 0];
    await this.play(
      frame.animate.scale(scaleFactor),
      zoomedDisplay.animate.scale(scaleFactor),
      new FadeOut(zoomedCameraText),
      new FadeOut(frameText),
    );
    await this.wait(1);
    await this.play(new ScaleInPlace(zoomedDisplay, 2));
    await this.wait(1);
    await this.play(frame.animate.shift(V.scale(DOWN, 2.5)));
    await this.wait(1);
    await this.play(
      this.getZoomedDisplayPopOutAnimation(),
      unfoldCamera(),
      { rateFunc: (t: number) => rate_functions.smooth(1 - t) },
    );
    await this.play(new Uncreate(zoomedDisplayFrame), new FadeOut(frame));
    await this.wait(1);
  }
}

await demoRender(MovingZoomedSceneAround, import.meta.url);

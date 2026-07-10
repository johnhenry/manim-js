// Port of Manim CE gallery: ManimCELogo (ref/ManimCELogo.py) — the community
// logo built from MathTex + primitive shapes. 1:1 modulo the documented
// conventions (camelCase configs, V.* vector math).

import {
  Scene, MathTex, Circle, Square, Triangle, VGroup,
  LEFT, UP, RIGHT, ORIGIN,
} from "../../src/node.ts";
import * as V from "../../src/core/math/vector.ts";
import { demoRender } from "./_run.ts";

class ManimCELogo extends Scene {
  async construct() {
    const logoGreen = "#87c2a5";
    const logoBlue = "#525893";
    const logoRed = "#e07a5f";
    const logoBlack = "#343434";
    const dsM = new MathTex("\\mathbb{M}", { fillColor: logoBlack }).scale(7);
    dsM.shift(V.add(V.scale(LEFT, 2.25), V.scale(UP, 1.5)));
    const circle = new Circle({ color: logoGreen, fillOpacity: 1 }).shift(LEFT);
    const square = new Square({ color: logoBlue, fillOpacity: 1 }).shift(UP);
    const triangle = new Triangle({ color: logoRed, fillOpacity: 1 }).shift(RIGHT);
    const logo = new VGroup(triangle, square, circle, dsM); // order matters
    logo.moveTo(ORIGIN);
    this.add(logo);
    await this.wait(1);
  }
}

await demoRender(ManimCELogo, import.meta.url, { background: "#ece6e2" });

// Recreation of the "Essence of linear algebra" ch. 14 eigenvector visual
// (3b1b, 2016): direction lines through the origin ride a repeated matrix
// transform — generic lines swing off their spans while the two
// eigen-directions stay put and pulse; MathTex shows the lambda scaling.
// Recreation of the visual, not a code port.

import {
  Line, MathTex, FadeIn, LaggedStart, Indicate,
  YELLOW, PINK, BLUE, TEAL, PURPLE, ORANGE,
  eigen2x2,
} from "../../src/node.ts";
import { LinearTransformationScene } from "../../src/scene/vector_space_scene.ts";
import { demoRender } from "./_run.ts";

const A: [[number, number], [number, number]] = [[3, 1], [0, 2]];
const HALF_LEN = 9; // long enough to cross the frame both ways

function directionLine(dir: number[], color: string, strokeWidth = 4): Line {
  const [dx, dy] = dir;
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n, uy = dy / n;
  return new Line(
    [-HALF_LEN * ux, -HALF_LEN * uy, 0],
    [HALF_LEN * ux, HALF_LEN * uy, 0],
    { color, strokeWidth },
  );
}

class Eigenvectors extends LinearTransformationScene {
  async construct() {
    // Eigen-directions of A from the library helper (values 3 and 2).
    const eig = eigen2x2(A);
    const eigenDirs = eig.map((e) => e.vector);

    // Two eigenlines + four generic direction lines through the origin.
    const eigenLines = [
      directionLine(eigenDirs[0], YELLOW, 5),
      directionLine(eigenDirs[1], PINK, 5),
    ];
    const genericDirs: number[][] = [
      [Math.cos(1.1), Math.sin(1.1)],
      [Math.cos(2.0), Math.sin(2.0)],
      [Math.cos(2.6), Math.sin(2.6)],
      [Math.cos(0.45), Math.sin(0.45)],
    ];
    const genericColors = [BLUE, TEAL, PURPLE, ORANGE];
    const genericLines = genericDirs.map((d, i) => directionLine(d, genericColors[i], 3));
    const allLines = [...genericLines, ...eigenLines];

    // Dim, fixed ghosts of each line's original span — after the transform,
    // generic lines visibly leave their ghost, eigenlines sit right on it.
    const ghosts = allLines.map((l) => {
      const g = l.copy() as Line;
      g.setOpacity(0.25);
      return g;
    });
    this.add(...ghosts);

    for (const l of allLines) {
      this.addTransformableMobject(l); // registers for transforms...
      this.add(l); // ...but scene membership is separate
    }

    // Matrix readout, top-left, fixed. (MathTex default ~48pt; scale down.)
    const label = new MathTex("A = \\begin{bmatrix} 3 & 1 \\\\ 0 & 2 \\end{bmatrix}").scale(0.8);
    label.moveTo([-5.2, 3.2, 0]);
    this.add(label);

    await this.play(new LaggedStart(
      allLines.map((l) => new FadeIn(l)),
      { lagRatio: 0.15, runTime: 1.5 },
    ));
    await this.wait(0.5);

    // Beat 1: apply A. Generic lines swing off their ghost spans; the two
    // eigenlines land exactly on their own spans and pulse.
    await this.applyMatrix(A, { runTime: 2.5 });

    const lam1 = new MathTex(`\\lambda_1 = ${eig[0].value}`, { color: YELLOW }).scale(0.75);
    lam1.moveTo([4.6, 0.55, 0]);
    const lam2 = new MathTex(`\\lambda_2 = ${eig[1].value}`, { color: PINK }).scale(0.75);
    // Place along the second eigen-direction, off to the upper-left branch.
    lam2.moveTo([-3.1 * eigenDirs[1][0] - 0.9, -3.1 * eigenDirs[1][1], 0]);
    await this.play(
      new Indicate(eigenLines[0], { scaleFactor: 1.04, color: "#FFFFFF" }),
      new Indicate(eigenLines[1], { scaleFactor: 1.04, color: "#FFFFFF" }),
      new FadeIn(lam1),
      new FadeIn(lam2),
    );
    await this.wait(1);

    // Beat 2: apply A again — eigenlines still glued to their spans (now
    // scaled by lambda^2), generic lines swing even further off.
    const label2 = new MathTex("A^2 = \\begin{bmatrix} 9 & 5 \\\\ 0 & 4 \\end{bmatrix}").scale(0.8);
    label2.moveTo(label.getCenter());
    this.remove(label);
    this.add(label2);
    await this.applyMatrix(A, { runTime: 2.5 });
    await this.play(
      new Indicate(eigenLines[0], { scaleFactor: 1.04, color: "#FFFFFF" }),
      new Indicate(eigenLines[1], { scaleFactor: 1.04, color: "#FFFFFF" }),
    );
    await this.wait(1.5);
  }
}

await demoRender(Eigenvectors, import.meta.url, { mathTex: true });

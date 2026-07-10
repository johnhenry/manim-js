// Recreation of the classic "sum of odd numbers = n squared" visual proof
// (3b1b visual-proof genre): unit squares accumulate as L-shaped shells —
// 1, 3, 5, 7, 9 — each shell a new color, completing a 5x5 square while a
// running MathTex equation updates. Recreation of the visual, not a code port.

import {
  Square, MathTex, FadeIn, LaggedStart, Indicate, Create,
  TransformMatchingTex,
  BLUE, YELLOW, GREEN, RED, PURPLE,
} from "../../src/node.ts";
import { Scene } from "../../src/scene/Scene.ts";
import { demoRender } from "./_run.ts";

const N = 5;
const CELL = 1.15;
const X0 = -6.1; // grid lower-left corner
const Y0 = -3.35;
const SHELL_COLORS = [BLUE, YELLOW, GREEN, RED, PURPLE];
const EQ_POS = [3.35, 1.6, 0];

function cellSquare(i: number, j: number, color: string): Square {
  const sq = new Square({
    sideLength: CELL * 0.92,
    fillColor: color,
    fillOpacity: 0.8,
    strokeColor: color,
    strokeWidth: 2,
  });
  sq.moveTo([X0 + (i + 0.5) * CELL, Y0 + (j + 0.5) * CELL, 0]);
  return sq;
}

// The k-th shell (0-indexed): cells with max(i, j) === k, walked across the
// top row then down the right column — the L that upgrades kxk to (k+1)x(k+1).
function shellCells(k: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let i = 0; i <= k; i++) cells.push([i, k]);
  for (let j = k - 1; j >= 0; j--) cells.push([k, j]);
  return cells;
}

// MathTex args for "1 + 3 + ... + (2k-1) = k^2", split for TransformMatchingTex.
function equationArgs(k: number): string[] {
  const args: string[] = [];
  for (let m = 1; m <= k; m++) {
    if (m > 1) args.push("+");
    args.push(String(2 * m - 1));
  }
  args.push("=", `${k}^2`);
  return args;
}

class SumOfOdds extends Scene {
  async construct() {
    await this.wait(0.5);

    let eq: MathTex | null = null;
    for (let k = 0; k < N; k++) {
      // Shell pieces slide in one by one from the upper-right.
      const pieces = shellCells(k).map(([i, j]) => cellSquare(i, j, SHELL_COLORS[k]));
      await this.play(new LaggedStart(
        pieces.map((p) => new FadeIn(p, { shift: [-0.7, -0.7, 0] })),
        { lagRatio: 0.35, runTime: 0.6 + 0.22 * pieces.length },
      ));

      // Running equation: 1 = 1^2, then 1 + 3 = 2^2, ...
      const next = new MathTex(...equationArgs(k + 1)).scale(0.9);
      next.moveTo(EQ_POS);
      if (eq === null) {
        await this.play(new FadeIn(next, { runTime: 0.6 }));
      } else {
        await this.play(new TransformMatchingTex(eq, next, { runTime: 0.7 }));
        // Settle scene membership: drop the morphed source (and any target
        // parts FadeIn introduced as top-level), keep the target group whole.
        this.remove(eq);
        for (const p of (next as any).parts ?? []) this.remove(p);
        this.add(next);
      }
      eq = next;
      await this.wait(0.4);
    }

    // The completed 5x5 square: draw the outline, then pulse it.
    const outline = new Square({
      sideLength: N * CELL,
      strokeColor: "#FFFFFF",
      strokeWidth: 5,
      fillOpacity: 0,
    });
    outline.moveTo([X0 + (N * CELL) / 2, Y0 + (N * CELL) / 2, 0]);
    await this.play(new Create(outline, { runTime: 1 }));
    await this.play(new Indicate(outline, { scaleFactor: 1.06, color: YELLOW, runTime: 1 }));
    await this.wait(1);
  }
}

await demoRender(SumOfOdds, import.meta.url, { mathTex: true });

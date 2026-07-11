// p5.js parity demo 06: ref/06-game-of-life.js — Conway's Game of Life on a
// toroidal grid (p5.js gallery, LGPL). The ref runs at frameRate(10) (10
// generations/sec); reproduced here by advancing CellularAutomaton.step()
// once every 0.1s of scene time via an updater, matching that cadence.
// Proves CellularAutomaton (src/mobject/cellular_automaton.ts, this
// campaign's gap-fill): seeded random init (mulberry32, never Math.random —
// deterministic/cache-safe), Conway's B3/S23 rule, toroidal wrap.

import { Scene, CellularAutomaton } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class GameOfLife extends Scene {
  async construct() {
    const ca = new CellularAutomaton({
      cols: 30,
      rows: 18,
      cellSize: 0.4,
      seed: 7,
      initialDensity: 0.35,
      aliveColor: "#4ade80",
    });
    this.add(ca);

    const genInterval = 0.1; // seconds per generation, matches frameRate(10)
    let acc = 0;
    ca.addUpdater((_m: any, dt: number) => {
      acc += dt;
      while (acc >= genInterval) {
        ca.step();
        acc -= genInterval;
      }
    });

    await this.wait(4); // ~40 generations
  }
}

await demoRender(GameOfLife, import.meta.url);

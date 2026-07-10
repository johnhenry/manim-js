// Recreation of the "But what IS a neural network?" visual (3b1b, 2017):
// a 784-16-16-10 layered network (input abbreviated with ellipsis dots)
// draws in layer by layer, a forward pass lights the input with a
// pseudo-image and pulses activations across each edge bundle, and the
// argmax output neuron glows next to its digit label.
// Recreation of the visual, not a code port.

import {
  Scene, Text, MathTex, Circle, Create, FadeIn,
  AnimationGroup, LaggedStart, NeuralNetworkMobject, Color,
} from "../../src/node.ts";
import { demoRender, BG } from "./_run.ts";

class NeuralNetwork extends Scene {
  async construct() {
    const nn = new NeuralNetworkMobject({
      layerSizes: [784, 16, 16, 10],
      seed: 7,
      layerSpacing: 2.4,
      neuronSpacing: 0.4,
    });
    nn.shift([-0.4, 0, 0]); // leave room for the digit readout on the right

    // --- Beat 1: the network draws in layer by layer -----------------------
    // Neurons via LaggedStart Create per column; each edge bundle fades in
    // together with the next column. (Children are added to the scene by the
    // plays; the nn Group itself is never added, so there is no double-draw.)
    const column = (l: number) => [...nn.neurons[l], ...nn.ellipsisDots[l]];
    await this.play(
      new LaggedStart(
        column(0).map((c) => new Create(c, { runTime: 0.5 })),
        { lagRatio: 0.06, runTime: 1.4 },
      ),
    );
    for (let g = 0; g < nn.edges.length; g++) {
      await this.play(
        new AnimationGroup(
          nn.edges[g].flat().map((e) => new FadeIn(e)),
          { runTime: 1.1 },
        ),
        new LaggedStart(
          column(g + 1).map((c) => new Create(c, { runTime: 0.4 })),
          { lagRatio: 0.06, runTime: 1.1 },
        ),
      );
    }

    // Edges run neuron-center to neuron-center, so the bundles converge
    // visibly inside the hollow circles. Mask with background-colored disks
    // stacked between the edges and the neuron strokes.
    const backers = nn.neurons.flat().map(
      (n) =>
        new Circle({
          radius: nn.neuronRadius,
          arcCenter: n.getCenter(),
          strokeWidth: 0,
          fillColor: BG,
          fillOpacity: 1,
        }),
    );
    const neuronsFlat = [...nn.neurons.flat(), ...nn.ellipsisDots.flat()];
    this.add(...backers);
    this.remove(...neuronsFlat);
    this.add(...neuronsFlat); // restack: edges < backers < neurons

    // Digit labels 0-9 beside the output neurons.
    const outputLayer = nn.neurons[nn.neurons.length - 1];
    const digitLabels = outputLayer.map((neuron, j) => {
      const t = new Text(String(j), { fontSize: 0.32, color: "#FFFFFF" });
      t.nextTo(neuron, [1, 0, 0], 0.18);
      return t;
    });
    await this.play(
      new LaggedStart(
        digitLabels.map((t) => new FadeIn(t, { runTime: 0.4 })),
        { lagRatio: 0.06, runTime: 1 },
      ),
    );
    await this.wait(0.5);

    // --- Beat 2: forward pass with a deterministic pseudo-image ------------
    // A fixed "pixel column" pattern over the 16 shown input neurons.
    const input = Array.from({ length: nn.shownSizes[0] }, (_, i) =>
      0.5 + 0.5 * Math.sin(i * 1.7 + 0.4),
    );
    const acts = nn.computeActivations(input);
    const out = acts[acts.length - 1];
    const argmax = out.indexOf(Math.max(...out));

    // forwardPass pulses bright throwaway copies of the edges (library
    // behavior), so the dim skeleton stays put — no ghost bookkeeping.
    await this.play(nn.forwardPass(input, { stepTime: 0.85, pulseTimeWidth: 0.4 }));
    await this.wait(0.3);

    // --- Beat 3: the argmax output neuron glows, big digit readout ---------
    const digit = new MathTex(String(argmax)).scale(2);
    digit.moveTo([5.4, outputLayer[argmax].getCenter()[1], 0]);
    await this.play(
      nn.highlightOutput(argmax, { runTime: 1.3 }),
      new FadeIn(digit, { runTime: 0.9, scale: 0.5 }),
    );
    await this.wait(1.2);
  }
}

await demoRender(NeuralNetwork, import.meta.url, { mathTex: true });

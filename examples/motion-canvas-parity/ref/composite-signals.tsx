// COMPOSITE: assembled verbatim from the fragments on
// motioncanvas.io/docs/signals (the page documents via fragments, not a
// full scene). Demonstrates: createSignal, computed signals, signal
// invocation forms (get/set/tween), and a signal-linked node property.

import {makeScene2D, Circle, Txt} from '@motion-canvas/2d';
import {all, createSignal, waitFor} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  const radius = createSignal(1);
  const area = createSignal(() => Math.PI * radius() * radius());

  view.add(
    <Circle
      width={() => radius() * 200}
      height={() => radius() * 200}
      fill={'#e13238'}
      x={-200}
    />,
  );
  view.add(
    <Txt
      text={() => `area: ${area().toFixed(2)}`}
      fill={'#f8f8f8'}
      x={250}
    />,
  );

  yield* waitFor(0.5);
  // tween the signal: every dependent property follows.
  yield* radius(2, 1.5);
  yield* radius(0.5, 1);
  yield* all(radius(1, 1));
});

// COMPOSITE: assembled verbatim from the fragments on
// motioncanvas.io/docs/random — useRandom() reproducible RNG (with an
// explicit seed variant) driving node placement.

import {makeScene2D, Circle} from '@motion-canvas/2d';
import {useRandom, waitFor} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  const random = useRandom(123);

  for (let i = 0; i < 10; i++) {
    const integer = random.nextInt(0, 10);
    view.add(
      <Circle
        x={random.nextFloat(-500, 500)}
        y={random.nextFloat(-250, 250)}
        size={20 + integer * 8}
        fill={'#68abdf'}
        opacity={0.8}
      />,
    );
  }
  yield* waitFor(1);
});

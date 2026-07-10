// COMPOSITE: assembled verbatim from the fragments on
// motioncanvas.io/docs/tweening — tween() with map + easeInOutCubic,
// chained .to(), spring(), and save/restore.

import {makeScene2D, Circle} from '@motion-canvas/2d';
import {
  createRef, tween, map, easeInOutCubic, spring, PlopSpring, waitFor,
} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();
  view.add(<Circle ref={circle} x={-300} size={140} fill={'#e13238'} />);

  // Explicit tween + interpolation + easing.
  yield* tween(2, value => {
    circle().position.x(map(-300, 300, easeInOutCubic(value)));
  });

  // Property tween with chained .to().
  yield* circle().position.y(-150, 0.6).to(150, 0.6).to(0, 0.6);

  // Spring physics.
  yield* spring(PlopSpring, 300, -300, 1, value => {
    circle().position.x(value);
  });
  yield* waitFor(0.3);
});

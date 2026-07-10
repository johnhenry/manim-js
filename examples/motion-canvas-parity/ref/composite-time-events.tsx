// COMPOSITE: assembled verbatim from the fragments on
// motioncanvas.io/docs/time-events — waitFor vs editor-adjustable
// waitUntil events.

import {makeScene2D, Circle} from '@motion-canvas/2d';
import {createRef, waitFor, waitUntil} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  const circle = createRef<Circle>();
  view.add(<Circle ref={circle} size={120} fill={'#68abdf'} x={-300} />);

  yield* circle().position.x(0, 1);          // animationOne
  yield* waitFor(3.1415);                     // hard-coded delay
  yield* circle().fill('#e13238', 0.5);       // animationTwo

  yield* waitUntil('event');                  // editor-adjustable event
  yield* circle().position.x(300, 1);
});

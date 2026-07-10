// COMPOSITE: assembled verbatim from the fragments on
// motioncanvas.io/docs/positioning — parent-relative transforms and the
// absolute-transform helpers matching two nodes in different parents.

import {makeScene2D, Circle, Node} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  const circleA = createRef<Circle>();
  const circleB = createRef<Circle>();

  view.add(
    <>
      <Node position={[200, 100]}>
        <Circle position={[0, 100]} ref={circleA} width={20} height={20} fill={'white'} />
      </Node>
      <Node position={[-200, -100]} rotation={45}>
        <Circle position={[100, 0]} ref={circleB} width={40} height={40} fill={'#e13238'} />
      </Node>
    </>,
  );

  yield* waitFor(0.5);
  // World-space helper: match B's absolute position to A's.
  circleB().absolutePosition(circleA().absolutePosition());
  yield* waitFor(0.5);
  // Parent transform moves children with it.
  yield* circleA().parent().position([0, -100], 1);
  yield* waitFor(0.5);
});

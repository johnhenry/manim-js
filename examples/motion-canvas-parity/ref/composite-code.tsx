// COMPOSITE: assembled verbatim from the fragments on
// motioncanvas.io/docs/code-block — CodeBlock display, edit-with-insert,
// and selection.

import {makeScene2D} from '@motion-canvas/2d';
import {CodeBlock, insert, lines} from '@motion-canvas/2d/lib/components/CodeBlock';
import {createRef, waitFor} from '@motion-canvas/core';

export default makeScene2D(function* (view) {
  const codeRef = createRef<CodeBlock>();

  yield view.add(<CodeBlock ref={codeRef} language="tsx" code={`var myBool;`} />);
  yield* waitFor(0.5);

  // duration of 1.2 seconds
  yield* codeRef().edit(1.2)`var myBool${insert(' = true')};`;
  yield* waitFor(0.5);

  // select a range to call attention to it
  yield* codeRef().selection(lines(0), 0.6);
  yield* waitFor(0.5);
});

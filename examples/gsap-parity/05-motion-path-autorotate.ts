// GSAP parity demo 05: ref/05-motion-path-autorotate.md — MotionPathPlugin's
// `motionPath` + `autoRotate: true` (gsap.com/docs/v3/Plugins/MotionPathPlugin).
// An object travels along a curved path and reorients every frame to match
// the path's tangent, "banking" through turns instead of sliding sideways.
//
// Recreated with MoveAlongPath (src/animation/extra.ts, `autoRotate` +
// `autoRotateOffset` -- JUST added this campaign per test/gsap-gaps.test.ts)
// along a Spline (src/mobject/curves.ts) zigzag with three direction
// reversals, so the tangent visibly swings between banking left and right --
// a straight line wouldn't show any rotation at all.
//
// The traveler is a hand-built arrowhead (Polygon), not the stock Triangle:
// a *regular* (equilateral) Triangle has 3-fold rotational symmetry, so all
// three vertices look equally "pointy" and a rotation can be genuinely
// ambiguous to the eye. This Polygon is an elongated, scalene arrowhead
// (long tip, short flat back) with no rotational symmetry at all, built
// pointing along its own +X axis -- matching the same "forward = +X, no
// offset needed" convention MoveAlongPath's own tests use (see the Line-
// based cases in test/gsap-gaps.test.ts) -- so autoRotateOffset can stay at
// its default 0 and the tip unambiguously tracks the path's tangent.

import { Scene, Spline, Polygon, MoveAlongPath, Create, ORANGE, WHITE } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

class MotionPathAutoRotate extends Scene {
  async construct() {
    // A zigzag S/W-shaped curve: three direction reversals so the tangent
    // swings left/right/left/right -- unlike a straight line, this makes
    // auto-rotation unmistakably visible frame to frame.
    const path = new Spline({
      points: [
        [-5.5, -1.5, 0],
        [-2.75, 2.2, 0],
        [0, -2.2, 0],
        [2.75, 2.2, 0],
        [5.5, -1.5, 0],
      ],
      strokeColor: WHITE,
      strokeWidth: 2,
      strokeOpacity: 0.5,
    });
    // Scalene arrowhead built pointing along +X (tip at [0.6,0], short flat
    // back at x=-0.35): asymmetric enough that every rotation looks visibly
    // distinct, unlike a symmetric equilateral Triangle. Added (at the
    // path's start point) BEFORE the path's Create so it's on screen from
    // frame 0 -- not just introduced mid-clip.
    const traveler = new Polygon(
      [
        [0.6, 0, 0],
        [-0.35, 0.35, 0],
        [-0.35, -0.35, 0],
      ],
      { color: ORANGE, fillOpacity: 1, strokeWidth: 0 },
    );
    traveler.moveTo(path.pointFromProportion(0));
    this.add(traveler);

    await this.play(new Create(path, { runTime: 1.0 }));
    await this.wait(0.3);

    await this.play(
      new MoveAlongPath(traveler, path, {
        autoRotate: true,
        runTime: 4,
      }),
    );
    await this.wait(0.6);
  }
}

await demoRender(MotionPathAutoRotate, import.meta.url);

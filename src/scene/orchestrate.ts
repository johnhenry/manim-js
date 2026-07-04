// Shared scene-orchestration helpers used by every backend (node, browser,
// browser-three, player). Extracted so the "Scene subclass or bare construct
// function" handling cannot drift between backends — it previously did: the
// browser copies forgot finalizeSections() on the construct-function path, so
// section-based features saw a dangling open section.

import { Scene } from "./Scene.ts";

/**
 * Duck-typed replacement for `instanceof Scene`. A scene file can import
 * `Scene` through a different module path than this file did (e.g. "ecmanim"
 * resolving to dist/index.js for the user's file vs. this file's own
 * "./Scene.ts" import in dev) — Node then loads two structurally-identical
 * but referentially-distinct classes, and `instanceof` fails even for a
 * legitimate Scene subclass. Check the shape instead: a Scene (base or
 * subclass) always has construct()/play()/wait() on its prototype chain.
 */
export function isSceneLike(v: any): boolean {
  if (typeof v !== "function" || !v.prototype) return false;
  const proto = v.prototype;
  return typeof proto.construct === "function" &&
    typeof proto.play === "function" &&
    typeof proto.wait === "function";
}

/**
 * Instantiate the user's Scene subclass with `config`, or a base Scene when
 * given a bare construct function.
 */
export function makeScene(sceneOrConstruct: any, config: any): Scene {
  if (typeof sceneOrConstruct === "function" && isSceneLike(sceneOrConstruct)) {
    return new sceneOrConstruct(config);
  }
  return new Scene(config);
}

/**
 * Drive the scene: run a Scene subclass's construct() via scene.render(), or
 * call a bare construct function with the scene. Sections are finalized on
 * both paths.
 *
 * `props` supports parameter-only re-render (Studio props panel): a Scene
 * subclass reads them from its own constructor's `config.props` (already
 * threaded through by `makeScene()` — no change needed here for that path);
 * a bare construct function receives them as a 2nd argument. Both are
 * opt-in — a construct function that only declares 1 parameter is
 * unaffected by the extra argument.
 */
export async function runConstruct(sceneOrConstruct: any, scene: Scene, props?: any): Promise<void> {
  if (typeof sceneOrConstruct === "function" && !isSceneLike(sceneOrConstruct)) {
    await sceneOrConstruct(scene, props);
    scene.finalizeSections();
  } else {
    await scene.render();
  }
}

// Private sentinel: distinguishes "we deliberately stopped construct() at the
// target time" from a real error thrown by the scene's own construct() code,
// so sampleSceneAt() only swallows its own signal and lets everything else
// propagate normally.
class SceneScrubStop {
  time: number;
  constructor(time: number) {
    this.time = time;
  }
}

/**
 * Run sceneOrConstruct's construct() from the very beginning, stopping as
 * soon as the scene's own simulated clock (Scene.time, advanced once per
 * frame inside play()/wait()) reaches `targetTime` seconds, and return the
 * driven Scene -- `scene.mobjects` reflects the interpolated state at
 * whichever frame boundary is at-or-just-past targetTime (frame-quantized,
 * the same way any rendered output is).
 *
 * This does NOT render any pixels (frameHandler is a no-op besides the time
 * check) -- it's a pure "replay the construct() script and tell me where
 * everything was at time t" query, for embedding/scrubbing a scene's
 * animation elsewhere (e.g. a compositing tool) without a full render.
 *
 * construct() is a sequential script (a manim-style "do X for N seconds,
 * then do Y") -- there is no way to "jump into the middle" without
 * re-running everything up to that point, so this re-executes construct()
 * from scratch on every call. Each frame's play()/wait() work is cheap (no
 * real rendering happens before the cutoff), so this is fine for
 * scrubbing/previewing, but isn't meant for a hot per-video-frame render
 * loop -- pass `targetTime: Infinity` to run to completion once and read
 * the final `scene.time` as the scene's total duration.
 */
export async function sampleSceneAt(sceneOrConstruct: any, targetTime: number, config: any = {}): Promise<Scene> {
  const scene = makeScene(sceneOrConstruct, config);
  scene.frameHandler = async (_mobjects, _frameCount, time) => {
    if (time >= targetTime) throw new SceneScrubStop(time);
  };
  try {
    await runConstruct(sceneOrConstruct, scene, config.props);
  } catch (e) {
    if (!(e instanceof SceneScrubStop)) throw e;
  }
  return scene;
}

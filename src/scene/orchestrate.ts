// Shared scene-orchestration helpers used by every backend (node, browser,
// browser-three, player). Extracted so the "Scene subclass or bare construct
// function" handling cannot drift between backends — it previously did: the
// browser copies forgot finalizeSections() on the construct-function path, so
// section-based features saw a dangling open section.

import { Scene } from "./Scene.ts";

/**
 * Instantiate the user's Scene subclass with `config`, or a base Scene when
 * given a bare construct function.
 */
export function makeScene(sceneOrConstruct: any, config: any): Scene {
  if (typeof sceneOrConstruct === "function" && sceneOrConstruct.prototype instanceof Scene) {
    return new sceneOrConstruct(config);
  }
  return new Scene(config);
}

/**
 * Drive the scene: run a Scene subclass's construct() via scene.render(), or
 * call a bare construct function with the scene. Sections are finalized on
 * both paths.
 */
export async function runConstruct(sceneOrConstruct: any, scene: Scene): Promise<void> {
  if (typeof sceneOrConstruct === "function" && !(sceneOrConstruct.prototype instanceof Scene)) {
    await sceneOrConstruct(scene);
    scene.finalizeSections();
  } else {
    await scene.render();
  }
}

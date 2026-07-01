// TransformMatchingShapes / TransformMatchingTex, ported from ManimCommunity's
// manim/animation/transform_matching_parts.py.
//
// These match submobjects between a source and a target by a "key", then:
//   - Transform each matched (source, target) pair,
//   - FadeOut source pieces with no match,
//   - FadeIn  target pieces with no match.
// The whole thing is assembled as an AnimationGroup so Scene.play drives it as
// one unit. Additive: imports from Animation.ts / composition.ts only.

import { Transform, FadeIn, FadeOut } from "./Animation.ts";
import type { AnimationConfig } from "./Animation.ts";
import { AnimationGroup } from "./composition.ts";
import type { Mobject } from "../mobject/Mobject.ts";

interface MatchingConfig extends AnimationConfig {
  // When a source piece has no exact key match, Transform it into the leftover
  // target group instead of fading (manim's transform_mismatches).
  transformMismatches?: boolean;
  // Cross-fade mismatched pieces via FadeTransform-style fades (approximated
  // here as FadeOut/FadeIn of the leftover groups). Default true.
  fadeTransformMismatches?: boolean;
  // Explicit key overrides: map from a source key to a target key.
  keyMap?: Record<string, string>;
}

// Round a number for stable hashing (manim hashes rounded point data).
function r(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// The "pieces" of a mobject to match on: its submobjects when it has them,
// otherwise the mobject itself.
function piecesOf(mobject: any): any[] {
  return mobject.submobjects && mobject.submobjects.length ? mobject.submobjects : [mobject];
}

// Shape key: number of points plus rounded bounding-box size. Two pieces with
// the same key are treated as "the same shape" and get Transform-paired.
function shapeKey(piece: any): string {
  const fam = piece.getFamily ? piece.getFamily() : [piece];
  let nPoints = 0;
  for (const m of fam) nPoints += m.points ? m.points.length : 0;
  let w = 0;
  let h = 0;
  if (piece.getWidth) {
    try {
      w = r(piece.getWidth());
      h = r(piece.getHeight());
    } catch {
      /* empty piece */
    }
  }
  return `${nPoints}|${w}|${h}`;
}

// Build the AnimationGroup of Transform / FadeIn / FadeOut pieces given a key
// function that maps a piece to its matching string.
function buildMatching(
  mobject: Mobject,
  target: Mobject,
  keyFn: (piece: any) => string,
  config: MatchingConfig,
): any[] {
  const fadeMismatches = config.fadeTransformMismatches ?? true;
  const transformMismatches = config.transformMismatches ?? false;
  const keyMap = config.keyMap ?? {};

  const sourcePieces = piecesOf(mobject);
  const targetPieces = piecesOf(target);

  // Index target pieces by key (first-come per key wins; extras stay leftover).
  const targetByKey = new Map<string, any[]>();
  for (const tp of targetPieces) {
    const k = keyFn(tp);
    if (!targetByKey.has(k)) targetByKey.set(k, []);
    targetByKey.get(k)!.push(tp);
  }

  const anims: any[] = [];
  const matchedTargets = new Set<any>();
  const unmatchedSources: any[] = [];

  for (const sp of sourcePieces) {
    const rawKey = keyFn(sp);
    const key = keyMap[rawKey] ?? rawKey;
    const bucket = targetByKey.get(key);
    if (bucket && bucket.length) {
      const tp = bucket.shift();
      matchedTargets.add(tp);
      anims.push(new Transform(sp, tp, config));
    } else {
      unmatchedSources.push(sp);
    }
  }

  const unmatchedTargets = targetPieces.filter((tp) => !matchedTargets.has(tp));

  if (transformMismatches && unmatchedSources.length && unmatchedTargets.length) {
    // Transform the leftover source group into the leftover target group.
    const n = Math.min(unmatchedSources.length, unmatchedTargets.length);
    for (let i = 0; i < n; i++) {
      anims.push(new Transform(unmatchedSources[i], unmatchedTargets[i], config));
    }
    // Any surplus still fades.
    if (fadeMismatches) {
      for (let i = n; i < unmatchedSources.length; i++) anims.push(new FadeOut(unmatchedSources[i], config));
      for (let i = n; i < unmatchedTargets.length; i++) anims.push(new FadeIn(unmatchedTargets[i], config));
    }
  } else if (fadeMismatches) {
    for (const sp of unmatchedSources) anims.push(new FadeOut(sp, config));
    for (const tp of unmatchedTargets) anims.push(new FadeIn(tp, config));
  }

  return anims;
}

// Match by shape (point count + bounding-box size).
export class TransformMatchingShapes extends AnimationGroup {
  constructor(mobject: Mobject, target: Mobject, config: MatchingConfig = {}) {
    const anims = buildMatching(mobject, target, shapeKey, config);
    super(anims, config);
    this.introducer = true;
    this.remover = true;
  }
}

// Match by tex-part string when both are MathTex-like (have `.parts` /
// `.texStrings`), else fall back to shape matching. When the mobjects expose
// part-level tex, we pair whole parts by their tex string.
export class TransformMatchingTex extends AnimationGroup {
  constructor(mobject: Mobject, target: Mobject, config: MatchingConfig = {}) {
    let anims: any[];
    const src: any = mobject;
    const tgt: any = target;
    if (src.parts && tgt.parts && src._partTex && tgt._partTex) {
      anims = TransformMatchingTex._buildByTex(src, tgt, config);
    } else {
      anims = buildMatching(mobject, target, shapeKey, config);
    }
    super(anims, config);
    this.introducer = true;
    this.remover = true;
  }

  // Pair MathTex parts by their tex string; leftovers fade.
  static _buildByTex(src: any, tgt: any, config: MatchingConfig): any[] {
    const fadeMismatches = config.fadeTransformMismatches ?? true;
    const keyMap = config.keyMap ?? {};

    const targetByTex = new Map<string, any[]>();
    for (let i = 0; i < tgt.parts.length; i++) {
      const k = String(tgt._partTex[i]);
      if (!targetByTex.has(k)) targetByTex.set(k, []);
      targetByTex.get(k)!.push(tgt.parts[i]);
    }

    const anims: any[] = [];
    const matchedTargets = new Set<any>();
    const unmatchedSources: any[] = [];

    for (let i = 0; i < src.parts.length; i++) {
      const rawKey = String(src._partTex[i]);
      const key = keyMap[rawKey] ?? rawKey;
      const bucket = targetByTex.get(key);
      if (bucket && bucket.length) {
        const tp = bucket.shift();
        matchedTargets.add(tp);
        anims.push(new Transform(src.parts[i], tp, config));
      } else {
        unmatchedSources.push(src.parts[i]);
      }
    }

    const unmatchedTargets = tgt.parts.filter((p: any) => !matchedTargets.has(p));
    if (fadeMismatches) {
      for (const sp of unmatchedSources) anims.push(new FadeOut(sp, config));
      for (const tp of unmatchedTargets) anims.push(new FadeIn(tp, config));
    }
    return anims;
  }
}

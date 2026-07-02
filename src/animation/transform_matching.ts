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
  // Explicit key overrides: map from a source key to a target key. For MathTex
  // the keys are tex strings (e.g. { "a^2": "c^2" }); for shape matching they
  // are shape keys. Lets authors force a mapping between differently-written
  // parts the automatic key match would otherwise fade.
  keyMap?: Record<string, string>;
}

// Round a number for stable hashing (manim hashes rounded point data).
function r(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// Is this mobject a MathTex-like object exposing addressable tex parts?
// (MathTex/Tex tag each part VGroup's tex via the parallel `_partTex` array.)
function isTexMobject(m: any): boolean {
  return !!(m && Array.isArray(m.parts) && Array.isArray(m._partTex) && m.parts.length === m._partTex.length);
}

// The "pieces" of a mobject to match on. For MathTex-like objects the pieces
// are the addressable part VGroups; otherwise its submobjects (or itself).
export function piecesOf(mobject: any): any[] {
  if (isTexMobject(mobject)) return mobject.parts.slice();
  return mobject.submobjects && mobject.submobjects.length ? mobject.submobjects : [mobject];
}

// Ordered [key, part] pairs for a mobject: tex keys for MathTex, shape keys
// otherwise. This is the single source of truth both TransformMatchingTex and
// TransformMatchingShapes build on, so the two share matching logic.
function keyedPieces(mobject: any): Array<[string, any]> {
  if (isTexMobject(mobject)) {
    return mobject.parts.map((p: any, i: number) => [String(mobject._partTex[i]), p] as [string, any]);
  }
  return piecesOf(mobject).map((p) => [shapeKey(p), p] as [string, any]);
}

// Public helper: for a MathTex return a Map from tex string -> part VGroup(s).
// When a tex key repeats, the value is the ordered list of parts sharing it;
// unique keys map to a single VGroup. Useful for authors and tests. For a
// non-tex mobject the keys are shape keys.
export function matchingParts(mobject: any): Map<string, any> {
  const map = new Map<string, any>();
  for (const [key, part] of keyedPieces(mobject)) {
    if (map.has(key)) {
      const cur = map.get(key);
      if (Array.isArray(cur)) cur.push(part);
      else map.set(key, [cur, part]);
    } else {
      map.set(key, part);
    }
  }
  return map;
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

// Build the AnimationGroup of Transform / FadeIn / FadeOut pieces given the
// ordered [key, piece] lists of source and target. Parts sharing a key are
// paired in order; keyMap forces a source-key -> target-key mapping; leftovers
// fade (or, with transformMismatches, transform by position order).
//
// This is the shared core: TransformMatchingTex feeds it tex-keyed pieces,
// TransformMatchingShapes feeds it shape-keyed pieces.
export function buildMatchingFromKeyed(
  sourceKeyed: Array<[string, any]>,
  targetKeyed: Array<[string, any]>,
  config: MatchingConfig,
): any[] {
  const fadeMismatches = config.fadeTransformMismatches ?? true;
  const transformMismatches = config.transformMismatches ?? false;
  const keyMap = config.keyMap ?? {};

  const targetPieces = targetKeyed.map(([, p]) => p);

  // Index target pieces by key (in order; a repeated key keeps a FIFO bucket
  // so repeats pair source-order to target-order).
  const targetByKey = new Map<string, any[]>();
  for (const [k, tp] of targetKeyed) {
    if (!targetByKey.has(k)) targetByKey.set(k, []);
    targetByKey.get(k)!.push(tp);
  }

  const anims: any[] = [];
  const matchedTargets = new Set<any>();
  const unmatchedSources: any[] = [];

  for (const [rawKey, sp] of sourceKeyed) {
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

// Back-compat wrapper: match by an explicit key function over piecesOf().
function buildMatching(
  mobject: Mobject,
  target: Mobject,
  keyFn: (piece: any) => string,
  config: MatchingConfig,
): any[] {
  const src: Array<[string, any]> = piecesOf(mobject).map((p) => [keyFn(p), p]);
  const tgt: Array<[string, any]> = piecesOf(target).map((p) => [keyFn(p), p]);
  return buildMatchingFromKeyed(src, tgt, config);
}

// Match by shape (point count + bounding-box size).
export class TransformMatchingShapes extends AnimationGroup {
  constructor(mobject: Mobject, target: Mobject, config: MatchingConfig = {}) {
    const anims = buildMatchingFromKeyed(
      piecesOf(mobject).map((p) => [shapeKey(p), p] as [string, any]),
      piecesOf(target).map((p) => [shapeKey(p), p] as [string, any]),
      config,
    );
    super(anims, config);
    this.introducer = true;
    this.remover = true;
  }
}

// Match by tex-part string when both are MathTex-like (expose `.parts` +
// `._partTex`), else fall back to shape matching. When the mobjects expose
// part-level tex, whole parts are keyed and paired by their tex string:
//   - same tex key in both        -> Transform (in order if a key repeats)
//   - keyMap { source: target }   -> Transform the forced pair
//   - source-only leftovers       -> FadeOut (or transform, see config)
//   - target-only leftovers       -> FadeIn
// Assembled as an AnimationGroup that is both introducer and remover.
export class TransformMatchingTex extends AnimationGroup {
  constructor(mobject: Mobject, target: Mobject, config: MatchingConfig = {}) {
    let anims: any[];
    if (isTexMobject(mobject) && isTexMobject(target)) {
      anims = buildMatchingFromKeyed(keyedPieces(mobject), keyedPieces(target), config);
    } else {
      // Not MathTex-like: degrade gracefully to shape matching.
      anims = buildMatching(mobject, target, shapeKey, config);
    }
    super(anims, config);
    this.introducer = true;
    this.remover = true;
  }
}

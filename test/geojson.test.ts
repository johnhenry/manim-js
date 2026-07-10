// GeoJSON loader (src/loaders/geojson_loader.ts) + projections: fixture with
// a square, a triangle, and a multipolygon-with-hole; byName addressing;
// project() landing inside its region; mercator vs equirectangular;
// hole winding; simplification.

import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGeoJSON } from "../src/loaders/geojson_loader.ts";
import { mercator, equirectangular } from "../src/loaders/geo_projection.ts";
import type { VMobject } from "../src/mobject/VMobject.ts";

const FIXTURE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Squareland" },
      geometry: {
        type: "Polygon",
        coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Triangonia" },
      geometry: {
        type: "Polygon",
        coordinates: [[[20, 0], [30, 0], [25, 10], [20, 0]]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Holey Isles" },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          // Island 1: outer ring with a hole.
          [
            [[0, 20], [10, 20], [10, 30], [0, 30], [0, 20]],
            [[4, 24], [6, 24], [6, 26], [4, 26], [4, 24]],
          ],
          // Island 2: plain square.
          [[[20, 20], [24, 20], [24, 24], [20, 24], [20, 20]]],
        ],
      },
    },
  ],
};

// Signed area over a subpath's world points (positive = CCW).
function subpathArea(mob: VMobject, subpath: number): number {
  const start = mob.subpathStarts[subpath];
  const end = mob.subpathStarts[subpath + 1] ?? mob.points.length;
  let sum = 0;
  for (let i = start; i < end; i++) {
    const [x1, y1] = mob.points[i];
    const [x2, y2] = mob.points[i === end - 1 ? start : i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

test("regions parse and are addressable by name; unknown name throws with the list", () => {
  const map = loadGeoJSON(FIXTURE, { width: 8 });
  assert.deepEqual([...map.regions.keys()].sort(), ["Holey Isles", "Squareland", "Triangonia"]);
  assert.ok(map.hasRegion("Squareland"));
  assert.equal(map.byName("Squareland").submobjects.length, 1);
  // MultiPolygon → one VMobject per polygon (2 islands).
  assert.equal(map.byName("Holey Isles").submobjects.length, 2);
  assert.throws(() => map.byName("Atlantis"), /Available: .*Squareland/);
  // Whole map fits the requested width.
  assert.ok(Math.abs(map.getWidth() - 8) < 1e-6);
});

test("string input parses the same as an object", () => {
  const map = loadGeoJSON(JSON.stringify(FIXTURE), { width: 8 });
  assert.equal(map.regions.size, 3);
});

test("holes are extra subpaths wound opposite to their exterior", () => {
  const map = loadGeoJSON(FIXTURE, { width: 8 });
  const island1 = map.byName("Holey Isles").submobjects[0] as VMobject;
  assert.equal(island1.subpathStarts.length, 2, "outer ring + hole ring");
  const outer = subpathArea(island1, 0);
  const hole = subpathArea(island1, 1);
  assert.ok(outer > 0, "exterior is CCW");
  assert.ok(hole < 0, "hole is CW (nonzero-fill safe)");
  assert.ok(Math.abs(hole) < Math.abs(outer));
});

test("project() maps lon/lat into the matching region's bounding box", () => {
  const map = loadGeoJSON(FIXTURE, { width: 8 });
  // Center of Squareland (5,5) must land inside Squareland's bbox.
  const p = map.project([5, 5]);
  const region = map.byName("Squareland");
  const [cx, cy] = region.getCenter();
  const hw = region.getWidth() / 2;
  const hh = region.getHeight() / 2;
  assert.ok(p[0] > cx - hw && p[0] < cx + hw, `x ${p[0]} inside region`);
  assert.ok(p[1] > cy - hh && p[1] < cy + hh, `y ${p[1]} inside region`);
  // And a far-away point lands outside it.
  const q = map.project([25, 3]); // Triangonia territory
  assert.ok(q[0] > cx + hw);
});

test("mercator stretches high latitudes relative to equirectangular", () => {
  // Same longitude span at 0° vs 60° latitude: equirect keeps the y spacing
  // linear; mercator grows it with latitude.
  const eqSpan = equirectangular(0, 62)[1] - equirectangular(0, 60)[1];
  const eqSpanLow = equirectangular(0, 2)[1] - equirectangular(0, 0)[1];
  assert.ok(Math.abs(eqSpan - eqSpanLow) < 1e-12, "equirectangular is linear in latitude");
  const mercSpan = mercator(0, 62)[1] - mercator(0, 60)[1];
  const mercSpanLow = mercator(0, 2)[1] - mercator(0, 0)[1];
  assert.ok(mercSpan > mercSpanLow * 1.5, "mercator stretches high latitudes");
  // Mercator clamps at the poles instead of diverging.
  assert.ok(Number.isFinite(mercator(0, 90)[1]));
  // The two projections produce different maps from the same data.
  const a = loadGeoJSON(FIXTURE, { width: 8, projection: "mercator" });
  const b = loadGeoJSON(FIXTURE, { width: 8, projection: "equirectangular" });
  assert.notEqual(a.getHeight(), b.getHeight());
});

test("simplifyTolerance reduces point count without destroying the shape", () => {
  // A circle-ish polygon with 100 points.
  const ring: number[][] = [];
  for (let i = 0; i < 100; i++) {
    const a = (i / 100) * Math.PI * 2;
    ring.push([10 + 5 * Math.cos(a), 10 + 5 * Math.sin(a)]);
  }
  ring.push([...ring[0]]);
  const blob = {
    type: "Feature",
    properties: { name: "Blob" },
    geometry: { type: "Polygon", coordinates: [ring] },
  };
  const full = loadGeoJSON(blob, { width: 8 });
  const simplified = loadGeoJSON(blob, { width: 8, simplifyTolerance: 0.2 });
  const fullPts = (full.byName("Blob").submobjects[0] as VMobject).points.length;
  const simplePts = (simplified.byName("Blob").submobjects[0] as VMobject).points.length;
  assert.ok(simplePts < fullPts / 2, `expected big reduction, got ${fullPts} -> ${simplePts}`);
  assert.ok(simplePts >= 3);
  // Shape survives: bbox unchanged within tolerance.
  assert.ok(Math.abs(full.getWidth() - simplified.getWidth()) < 0.5);
});

test("LineString features become stroke-only paths", () => {
  const route = {
    type: "FeatureCollection",
    features: [
      FIXTURE.features[0],
      {
        type: "Feature",
        properties: { name: "Route 1" },
        geometry: { type: "LineString", coordinates: [[0, 0], [5, 5], [10, 0]] },
      },
    ],
  };
  const map = loadGeoJSON(route, { width: 8 });
  const line = map.byName("Route 1").submobjects[0] as VMobject;
  assert.equal(line.fillOpacity, 0);
  // setPointsAsCorners may insert handle points; a single open subpath remains.
  assert.equal(line.subpathStarts.length, 1);
  assert.ok(line.points.length >= 3);
});

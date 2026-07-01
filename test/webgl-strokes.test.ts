import { test } from "node:test";
import assert from "node:assert/strict";
import { ThreeRenderer } from "../src/renderer/ThreeRenderer.ts";
import { buildStrokeGeometry, makeBezierStrokeMaterial } from "../src/renderer/bezier_shader.ts";
import { Circle } from "../src/mobject/geometry.ts";
import { Camera } from "../src/renderer/CanvasRenderer.ts";

// Mock of the Three.js surface used by ThreeRenderer + the SDF stroke path.
// Mirrors test/three.test.ts's mock, extended with ShaderMaterial,
// MeshStandardMaterial, DirectionalLight, AmbientLight, Vector2 and
// geometry.computeVertexNormals().
function mockTHREE() {
  const V3 = () => ({ set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
  const cam = (extra) => ({
    position: V3(), up: V3(), lookAt() {}, updateProjectionMatrix() {}, ...extra,
  });
  return {
    ColorManagement: { enabled: true },
    DoubleSide: 2,
    Color: class { constructor(r, g, b) { this.r = r; this.g = g; this.b = b; } },
    Vector2: class { constructor(x, y) { this.x = x; this.y = y; } },
    WebGLRenderer: class { setPixelRatio() {} setSize() {} render() { this.rendered = true; } dispose() {} },
    Scene: class { constructor() { this.children = []; } add(o) { this.children.push(o); } },
    Group: class { constructor() { this.children = []; } add(o) { this.children.push(o); } clear() { this.children = []; } },
    PerspectiveCamera: class { constructor(fov, asp) { Object.assign(this, cam({ isPerspectiveCamera: true, fov, aspect: asp })); } },
    OrthographicCamera: class { constructor() { Object.assign(this, cam({ isOrthographicCamera: true })); } },
    BufferGeometry: class {
      setAttribute(k, v) { (this.attrs ??= {})[k] = v; }
      computeVertexNormals() { this.normalsComputed = true; }
      dispose() {}
    },
    Float32BufferAttribute: class { constructor(arr, size) { this.array = arr; this.itemSize = size; } },
    MeshBasicMaterial: class { constructor(o) { Object.assign(this, o); this.isMeshBasicMaterial = true; } dispose() {} },
    MeshStandardMaterial: class { constructor(o) { Object.assign(this, o); this.isMeshStandardMaterial = true; } dispose() {} },
    LineBasicMaterial: class { constructor(o) { Object.assign(this, o); } dispose() {} },
    ShaderMaterial: class { constructor(o) { Object.assign(this, o); this.isShaderMaterial = true; } dispose() {} },
    DirectionalLight: class { constructor(c, i) { this.isDirectionalLight = true; this.color = c; this.intensity = i; this.position = V3(); } },
    AmbientLight: class { constructor(c, i) { this.isAmbientLight = true; this.color = c; this.intensity = i; } },
    Mesh: class { constructor(g, m) { this.isMesh = true; this.geometry = g; this.material = m; } },
    LineSegments: class { constructor(g, m) { this.isLine = true; this.geometry = g; this.material = m; } },
  };
}

test("buildStrokeGeometry expands 2 segments into 2 quads (12 vertices)", () => {
  const THREE = mockTHREE();
  // Two segments: (0,0,0)->(1,0,0) and (1,0,0)->(1,1,0).
  const segments = [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0];
  const colors = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1];
  const g = buildStrokeGeometry(THREE, segments, null, colors);
  const pos = g.attrs.position.array;
  const corner = g.attrs.corner.array;
  assert.equal(pos.length, 12 * 3, "12 vertices x 3 components");
  assert.equal(corner.length, 12 * 2, "12 vertices x 2 corner components");
  assert.equal(g.attrs.aStart.array.length, 12 * 3);
  assert.equal(g.attrs.aEnd.array.length, 12 * 3);
  assert.equal(g.attrs.instanceColor.array.length, 12 * 3);
  assert.ok(pos.every(Number.isFinite));
});

test("makeBezierStrokeMaterial builds a ShaderMaterial with the right uniforms", () => {
  const THREE = mockTHREE();
  const m = makeBezierStrokeMaterial(THREE, { width: 6, resolution: [640, 360], color: [0.2, 0.4, 0.8] });
  assert.ok(m.isShaderMaterial);
  assert.equal(m.uniforms.uWidth.value, 6);
  assert.equal(m.uniforms.uResolution.value.x, 640);
  assert.equal(m.uniforms.uResolution.value.y, 360);
  assert.ok(m.transparent);
  assert.equal(m.depthWrite, false);
  assert.ok(typeof m.vertexShader === "string" && m.vertexShader.length > 0);
  assert.ok(typeof m.fragmentShader === "string" && m.fragmentShader.length > 0);
});

test("strokeMode:'sdf' renders a Circle using the bezier ShaderMaterial mesh", () => {
  const THREE = mockTHREE();
  const camera = new Camera({ pixelWidth: 640, pixelHeight: 360 });
  const r = new ThreeRenderer(THREE, { camera, canvas: {}, strokeMode: "sdf", strokeWidth: 5 });
  r.render([new Circle({ radius: 1, strokeColor: "#FFFFFF", strokeWidth: 4 })]);
  const strokeMesh = r.group.children.find((c) => c.isMesh && c.material && c.material.isShaderMaterial);
  assert.ok(strokeMesh, "a mesh using the bezier shader material was added");
  // Expanded-quad geometry: 6 verts per segment.
  assert.equal(strokeMesh.geometry.attrs.position.array.length % (6 * 3), 0);
  assert.ok(strokeMesh.geometry.attrs.corner, "has the SDF corner attribute");
  // No plain LineSegments in sdf mode.
  assert.ok(!r.group.children.some((c) => c.isLine), "no LineSegments in sdf mode");
  assert.ok(r.renderer.rendered);
});

test("lit:true adds lights and uses MeshStandardMaterial with computed normals", () => {
  const THREE = mockTHREE();
  const camera = new Camera({ pixelWidth: 640, pixelHeight: 360 });
  const r = new ThreeRenderer(THREE, { camera, canvas: {}, lit: true });
  // Lights added to the scene at construction.
  assert.ok(r.scene.children.some((c) => c.isDirectionalLight), "directional light added");
  assert.ok(r.scene.children.some((c) => c.isAmbientLight), "ambient light added");
  r.render([new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1 })]);
  const litMesh = r.group.children.find((c) => c.isMesh && c.material && c.material.isMeshStandardMaterial);
  assert.ok(litMesh, "a fill mesh uses MeshStandardMaterial");
  assert.ok(litMesh.geometry.normalsComputed, "vertex normals were computed");
});

test("default path is unchanged: LineSegments + MeshBasicMaterial, no lights", () => {
  const THREE = mockTHREE();
  const camera = new Camera({ pixelWidth: 640, pixelHeight: 360 });
  const r = new ThreeRenderer(THREE, { camera, canvas: {} });
  assert.equal(r.strokeMode, "line");
  assert.equal(r.lit, false);
  assert.ok(!r.scene.children.some((c) => c.isDirectionalLight || c.isAmbientLight), "no lights by default");
  r.render([new Circle({ radius: 1, fillColor: "#58C4DD", fillOpacity: 1, strokeColor: "#FFFFFF", strokeWidth: 4 })]);
  const fill = r.group.children.find((c) => c.isMesh);
  assert.ok(fill && fill.material.isMeshBasicMaterial, "fill uses MeshBasicMaterial");
  assert.ok(r.group.children.some((c) => c.isLine), "stroke uses LineSegments");
  assert.ok(!r.group.children.some((c) => c.material && c.material.isShaderMaterial), "no shader material by default");
});

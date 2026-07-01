import { test } from "node:test";
import assert from "node:assert/strict";
import { ThreeDCamera, ThreeDScene, ThreeDAxes } from "../src/scene/three_d.ts";
import * as V from "../src/core/math/vector.ts";
import { Line } from "../src/mobject/geometry.ts";

const CFG = { pixelWidth: 640, pixelHeight: 360, frameWidth: 640 / 360 * 8, frameHeight: 8 };

// Reference upright view: theta=-90, phi=0, gamma=0.
test("gamma=0 keeps [1,0,0] to the right and [0,1,0] up", () => {
  const cam = new ThreeDCamera({ ...CFG, phi: 0, theta: -90 * V.DEGREES, gamma: 0 });
  const cx = (CFG.pixelWidth) / 2, cy = CFG.pixelHeight / 2;
  const [rx, ry] = cam.toPixel([1, 0, 0]);
  const [ux, uy] = cam.toPixel([0, 1, 0]);
  // x-axis point projects to the right of center, roughly on the horizontal line.
  assert.ok(rx > cx, "x point is to the right");
  assert.ok(Math.abs(ry - cy) < 1, "x point stays on the center horizontal");
  // y-axis point projects above center, roughly on the vertical line.
  assert.ok(uy < cy, "y point is above (smaller pixel-y)");
  assert.ok(Math.abs(ux - cx) < 1, "y point stays on the center vertical");
});

test("gamma=PI/2 rolls the x-axis point toward vertical", () => {
  const cam = new ThreeDCamera({ ...CFG, phi: 0, theta: -90 * V.DEGREES, gamma: Math.PI / 2 });
  const cx = CFG.pixelWidth / 2, cy = CFG.pixelHeight / 2;
  const [rx, ry] = cam.toPixel([1, 0, 0]);
  // After a 90deg roll, the horizontal x-axis point maps onto the vertical axis.
  assert.ok(Math.abs(rx - cx) < 1, "x point now sits on the vertical (roll)");
  assert.ok(Math.abs(ry - cy) > 1, "x point moved off the horizontal");
});

test("getLightDirection normalizes the light source", () => {
  const cam = new ThreeDCamera({ ...CFG });
  const d = cam.getLightDirection();
  assert.ok(Math.abs(V.length(d) - 1) < 1e-9);
});

test("ThreeDAxes.c2p maps origin, right, and z distinctly", () => {
  const ax = new ThreeDAxes({ xRange: [-4, 4, 1], yRange: [-4, 4, 1], zRange: [-4, 4, 1] });
  const o = ax.c2p(0, 0, 0);
  assert.ok(V.length(o) < 1e-6, "c2p(0,0,0) is the origin");
  const rx = ax.c2p(1, 0, 0);
  assert.ok(rx[0] > 0 && Math.abs(rx[1]) < 1e-9 && Math.abs(rx[2]) < 1e-9, "c2p(1,0,0) goes +x");
  const pz = ax.c2p(0, 0, 1);
  const py = ax.c2p(0, 1, 0);
  assert.ok(Math.abs(pz[2]) > 1e-6, "c2p(0,0,1) has a real z-component");
  assert.ok(Math.abs(py[2]) < 1e-9 && Math.abs(py[1]) > 1e-6, "c2p(0,1,0) is in-plane");
  // The z point projects differently than the y point under the 3D camera.
  const cam = new ThreeDCamera({ ...CFG, phi: 70 * V.DEGREES, theta: -45 * V.DEGREES });
  const [, zpy] = cam.toPixel(pz);
  const [, ypy] = cam.toPixel(py);
  assert.ok(Math.abs(zpy - ypy) > 1, "z and y project to different screen positions");
});

test("ThreeDAxes exposes getAxis / getZAxis", () => {
  const ax = new ThreeDAxes({});
  assert.equal(ax.getAxis(0), ax.xAxis);
  assert.equal(ax.getAxis(2), ax.zAxis);
  assert.equal(ax.getZAxis(), ax.zAxis);
});

test("addFixedInFrameMobjects marks _fixedInFrame and adds it", () => {
  const scene = new ThreeDScene(CFG);
  const line = new Line([0, 0, 0], [1, 0, 0]);
  scene.addFixedInFrameMobjects(line);
  assert.equal((line as any)._fixedInFrame, true);
  assert.ok(scene.mobjects.includes(line));
});

test("moveCamera tweens gamma to its target", async () => {
  const scene = new ThreeDScene({ ...CFG, fps: 5 });
  scene.frameHandler = async () => {};
  await scene.moveCamera({ gamma: Math.PI / 2 }, { runTime: 0.4 });
  assert.ok(Math.abs(scene.camera.gamma - Math.PI / 2) < 1e-6);
});

test("setToDefaultAngledCameraOrientation sets phi/theta", () => {
  const scene = new ThreeDScene(CFG);
  scene.setToDefaultAngledCameraOrientation();
  assert.ok(scene.camera.phi > 0, "phi tilted");
  assert.ok(scene.camera.theta < 0, "theta rotated negative");
  assert.ok(Math.abs(scene.camera.phi - 75 * V.DEGREES) < 1e-9);
});

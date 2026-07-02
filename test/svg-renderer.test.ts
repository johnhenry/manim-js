import { test } from "node:test";
import assert from "node:assert/strict";

import { Camera } from "../src/renderer/CanvasRenderer.ts";
import { SVGRenderer, mobjectsToSVG } from "../src/renderer/SVGRenderer.ts";
import { Circle, Square, Line, Polygon } from "../src/mobject/geometry.ts";
import { Sphere } from "../src/mobject/surface.ts";

function makeCamera() {
  return new Camera({ pixelWidth: 1920, pixelHeight: 1080, frameHeight: 8 });
}

test("renderToString produces a well-formed standalone SVG document", () => {
  const camera = makeCamera();
  const r = new SVGRenderer(camera);
  const svg = r.renderToString([new Circle({ radius: 1, fillColor: "#FF0000", fillOpacity: 1 })]);

  assert.ok(svg.startsWith("<svg"), "starts with <svg");
  assert.ok(svg.endsWith("</svg>"), "ends with </svg>");
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), "has xmlns");
  assert.ok(
    svg.includes(`viewBox="0 0 ${camera.pixelWidth} ${camera.pixelHeight}"`),
    "viewBox matches camera pixel size",
  );
  assert.ok(svg.includes(`width="${camera.pixelWidth}"`), "width matches");
  assert.ok(svg.includes(`height="${camera.pixelHeight}"`), "height matches");
});

test("no NaN or undefined leaks into output", () => {
  const camera = makeCamera();
  const r = new SVGRenderer(camera);
  const svg = r.renderToString([
    new Circle({ radius: 1, fillColor: "#00FF00", fillOpacity: 1 }),
    new Square({ sideLength: 2 }),
    new Line([-1, -1, 0], [1, 1, 0]),
    new Polygon([[0, 0, 0], [1, 0, 0], [0, 1, 0]], { fillColor: "#0000FF", fillOpacity: 1 }),
  ]);
  assert.ok(!/NaN|undefined/.test(svg), "no NaN/undefined in output");
  // Balanced <path opens and closes (each path is self-closing "/>").
  const opens = (svg.match(/<path\b/g) ?? []).length;
  const closes = (svg.match(/\/>/g) ?? []).length;
  assert.ok(opens > 0, "at least one path");
  assert.ok(closes >= opens, "every path element closes");
});

test("a filled Circle emits a <path> with d=\"M...C...\", a real fill and fill-opacity", () => {
  const camera = makeCamera();
  const r = new SVGRenderer(camera);
  const svg = r.renderToString([new Circle({ radius: 1, fillColor: "#FF0000", fillOpacity: 1 })]);

  assert.ok(/<path\b/.test(svg), "has a <path");
  assert.ok(/d="M[^"]*C[^"]*"/.test(svg), "path d has M and C commands");
  // Fill present and not "none".
  const fillMatch = svg.match(/fill="(rgba\([^"]*\)|#[0-9a-fA-F]+)"/);
  assert.ok(fillMatch, "has a real fill color");
  assert.ok(/fill-opacity="[^"]+"/.test(svg), "has fill-opacity");
  assert.ok(/fill-rule="nonzero"/.test(svg), "has nonzero fill-rule");
});

test("a stroked-only shape has fill=\"none\" plus stroke and stroke-width", () => {
  const camera = makeCamera();
  const r = new SVGRenderer(camera);
  // Circle default: RED stroke, fillOpacity 0 -> stroke only.
  const svg = r.renderToString([new Circle({ radius: 1 })]);

  assert.ok(/fill="none"/.test(svg), "fill is none for stroke-only");
  assert.ok(/stroke="(rgba\([^"]*\)|#[0-9a-fA-F]+)"/.test(svg), "has stroke color");
  assert.ok(/stroke-width="[^"]+"/.test(svg), "has stroke-width");
});

test("a Square at the origin projects its corners to the expected pixel coords", () => {
  const camera = makeCamera();
  // Build renderer with explicit precision to match assertion rounding.
  const rr = new SVGRenderer(camera, { precision: 2 });
  const sq = new Square({ sideLength: 2 });
  const svg = rr.renderToString([sq]);

  // The square's corners are at (+/-1, +/-1). Compute expected pixel coords.
  const round = (v: number) => Number(v.toFixed(2)).toString();
  for (const corner of [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0]]) {
    const [px, py] = camera.toPixel(corner);
    assert.ok(
      svg.includes(round(px)),
      `expected pixel x ${round(px)} for corner ${corner} present`,
    );
    assert.ok(
      svg.includes(round(py)),
      `expected pixel y ${round(py)} for corner ${corner} present`,
    );
  }
});

test("painter order: overlapping mobjects appear in z-index order", () => {
  const camera = makeCamera();
  const r = new SVGRenderer(camera);
  const back = new Square({ sideLength: 2, fillColor: "#112233", fillOpacity: 1 });
  back.zIndex = 0;
  const front = new Circle({ radius: 1, fillColor: "#445566", fillOpacity: 1 });
  front.zIndex = 5;

  // Pass front first in array; zIndex should still put it after (later) in doc.
  const svg = r.renderToString([front, back]);
  const backIdx = svg.indexOf("17, 34, 51"); // rgb of #112233
  const frontIdx = svg.indexOf("68, 85, 102"); // rgb of #445566
  assert.ok(backIdx !== -1 && frontIdx !== -1, "both fills present");
  assert.ok(backIdx < frontIdx, "lower zIndex drawn first (earlier in doc)");
});

test("partial strokeEnd yields a shorter path than a full one", () => {
  const camera = makeCamera();
  const r = new SVGRenderer(camera);

  const full = new Circle({ radius: 1 });
  full.strokeEnd = 1;
  const half = new Circle({ radius: 1 });
  half.strokeEnd = 0.5;

  const svgFull = r.renderToString([full]);
  const svgHalf = r.renderToString([half]);

  const countC = (s: string) => (s.match(/C/g) ?? []).length;
  const dFull = svgFull.match(/d="([^"]*)"/)?.[1] ?? "";
  const dHalf = svgHalf.match(/d="([^"]*)"/)?.[1] ?? "";

  assert.ok(dHalf.length < dFull.length, "half path data is shorter");
  assert.ok(countC(svgHalf) < countC(svgFull), "half has fewer C commands");
});

test("mobjectsToSVG convenience builds a camera and renders", () => {
  const svg = mobjectsToSVG([new Circle({ radius: 1, fillColor: "#FF0000", fillOpacity: 1 })], {
    pixelWidth: 640,
    pixelHeight: 360,
    frameHeight: 8,
  });
  assert.ok(svg.startsWith("<svg"), "starts with <svg");
  assert.ok(svg.includes('viewBox="0 0 640 360"'), "viewBox reflects given size");
  assert.ok(!/NaN|undefined/.test(svg), "no NaN/undefined");
});

test("background option emits a bg rect; default is transparent", () => {
  const camera = makeCamera();
  const withBg = new SVGRenderer(camera, { background: "#000000" }).renderToString([]);
  assert.ok(/<rect[^>]*fill="#000000"/.test(withBg), "background rect present");

  const noBg = new SVGRenderer(camera).renderToString([]);
  assert.ok(!/<rect/.test(noBg), "no background rect by default");
});

test("a 3D-ish scene (Sphere) does not throw and returns an <svg>", () => {
  const camera = makeCamera();
  const r = new SVGRenderer(camera);
  let svg = "";
  assert.doesNotThrow(() => {
    const sphere = new Sphere({ radius: 1 });
    svg = r.renderToString([sphere]);
  });
  assert.ok(svg.startsWith("<svg"), "returns an <svg document");
  assert.ok(svg.endsWith("</svg>"), "closes the svg document");
  assert.ok(!/NaN|undefined/.test(svg), "no NaN/undefined for 3D scene");
});

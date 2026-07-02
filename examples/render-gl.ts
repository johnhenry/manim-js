// Opt-in headless GPU render: draw a 3D scene with the Three.js/WebGL backend
// inside a headless Chrome (Mesa llvmpipe — no physical GPU needed), captured
// back to a video file in Node. This is the GPU-quality alternative to the
// default CPU Canvas-2D renderer (real per-pixel lighting, MSAA, GPU strokes).
//
// Requirements:
//   1) `npm run build` first (the harness loads the built dist/browser-three.js).
//   2) A CDP-accessible Chrome. Set MANIM_CDP_URL or use the default
//      http://localhost:9222. Launch one with, e.g.:
//        google-chrome --headless=new --remote-debugging-port=9222 \
//          --use-gl=angle --use-angle=swiftshader-webgl --disable-gpu-sandbox
//
// The scene must live in its own BROWSER-importable module (it runs in the
// page), so it is defined in examples/scenes/gl-demo-scene.ts and referenced
// here by path — mirroring how renderParallel takes a scene module.
//
// Run: node examples/render-gl.ts   ->   examples/out/render-gl.mp4

import { renderGL } from "../src/node.ts";
import { probeCDP } from "../src/renderer/cdp.ts";

const cdpUrl = process.env.MANIM_CDP_URL ?? "http://localhost:9222";

if (!(await probeCDP(cdpUrl))) {
  console.log(
    `No CDP-accessible Chrome at ${cdpUrl}. The GL renderer needs one; the\n` +
    `default CPU renderer (\`render(...)\`) needs nothing. Skipping.`,
  );
  process.exit(0);
}

const res = await renderGL({
  sceneModule: "examples/scenes/gl-demo-scene.ts",
  sceneExport: "default",
  root: process.cwd(),
  cdpUrl,
  output: "examples/out/render-gl.mp4",
  format: "mp4",
  quality: "medium",
  fps: 30,
  background: "#0d1117",
});

console.log(`GL render (${res.renderer}) -> ${res.output} (${res.bytes} bytes)`);

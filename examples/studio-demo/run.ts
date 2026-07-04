import { startStudio } from "../../src/studio/dev_server.ts";

const studio = await startStudio({
  sceneModule: "examples/studio-demo/scene.js",
  root: process.cwd(),
  port: 5959,
  host: "0.0.0.0",
  interactive: true,
  waveform: true,
  props: true,
});

console.log("ecmanim Studio reachable at:");
for (const u of studio.urls) console.log(" -", u);

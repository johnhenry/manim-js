# Authoring layer & Studio

Phase-7 adoption. Two opt-in subpath entries (`manim-js/authoring`,
`manim-js/studio`) keep the core `manim-js` entry lean.

## `manim-js/authoring`

### Plan IR + dry-run

```js
import { toPlanIR } from "manim-js/authoring";
const plan = await toPlanIR(MyScene, { fps: 30, width: 1920, height: 1080, promise: "motion-led" });
// { version, config, segments[], chapters[], estimatedFrames, durationSeconds, quality }
```
Harvests structure **without rendering** (dry-runs `construct()`). CLI:
`manim-js plan scene.ts [Scene] [--fps 30] [--promise motion-led] [--output plan.json]`.

### Quality gates

```js
import { runQualityGates, slideshowRisk } from "manim-js/authoring";
const report = runQualityGates(ctx);           // { ok, slideshowRisk, results[] }
```
`slideshowRisk` scores how static the output is; `checkDeliveryPromise` asserts the
output matches a declared intent (e.g. promising `"motion-led"` but delivering
mostly stills fails). `toPlanIR` runs these automatically.

### Formats + providers (prompt→video)

```js
import { runFormat, manimRenderProvider, registerFormat } from "manim-js/authoring";

const res = await runFormat("title-card", {
  topic: "manim-js",
  params: { bullets: ["a", "b"], renderOptions: { output: "out.mp4" } },
  providers: { render: manimRenderProvider },   // llm / tts / render are swappable
});
```
A `Format` runs `plan → generateAssets → compose` (with an optional `revise`
feedback step). The `render` provider is backed by manim-js, so manim-js can be
the renderer for scrollmark/showrunner-style pipelines. Register your own formats
and providers.

## `manim-js/studio`

### Live-preview dev server

```js
import { startStudio } from "manim-js/studio";
const studio = await startStudio({ sceneModule: "scenes/demo.js", root: process.cwd() });
console.log(studio.url); // open it; edit the scene file → the browser hot-reloads
// studio.close() when done
```
Serves your Scene in a `<manim-player>` and re-imports + re-renders on every save
(file-watch + Server-Sent Events, dependency-free).

**What Studio is today, honestly:** the hot-reload dev server above and the
`schemaToControls` data layer below — that's it. The heavier features you might
expect from a "studio" are **not implemented**: no checkpoint replay (every save
re-renders the whole scene from scratch), no mouse camera pan/zoom/orbit, no
in-page eval REPL, and no rendered props-panel UI (only the control *descriptors*
exist; nothing draws them). These are planned on top of this foundation.

### Schema → props controls

```js
import { schemaToControls } from "manim-js/studio";
const controls = schemaToControls(MyScene.schema); // [{ name, control, min, max, options, ... }]
```
Turns a `defineSchema` spec into control descriptors for a props panel. This is
data only — you render the controls with your own UI; Studio's harness page does
not (yet) draw them.

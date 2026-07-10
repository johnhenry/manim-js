# Showcase parity: one demo per remotion.dev/showcase entry

Every entry on [remotion.dev/showcase](https://www.remotion.dev/showcase),
reproduced as a self-contained ecmanim demo. The original assessment (before
Clusters A/B/S/P landed) scored ecmanim **4 Strong / 8 Good / 6 Partial**
against these entries; the demos below are the receipts for the after-state:
**16 Strong + 2 Strong (compositing scope — device capture excluded)**.

## Running

```bash
npm run demos:showcase                 # all 18 -> examples/showcase-parity/out/*.mp4
node --experimental-strip-types examples/showcase-parity/01-hackreels.ts   # just one
```

| Env var | Effect |
|---|---|
| `ECMANIM_DEMO_QUALITY` | `low` \| `medium` (default) \| `high` |
| `ECMANIM_DEMO_SKIP_GL=1` | skip the renderGL demo (15) when no CDP Chrome |
| `ECMANIM_TTS=openai` | upgrade voiceover demos from the silent provider |
| `ECMANIM_RENDER_SERVICE_URL` | point demo 05 at an external coordinator (else it self-hosts one in-process) |

Iterating on a demo? Delete `out/partial/` (and `out/_gen/` for two-stage
demos) — static pre-play mutations aren't captured by the segment content
hash, so stale partials can be reused after an edit.

## The 18 demos

| # | Showcase entry | Before → After | Demo | Features proven |
|---|---|---|---|---|
| 01 | HackReels (code reels) | Good → **Strong** | `01-hackreels.ts` | `Code.diffTo()` token morph, MovingCamera push-in, per-line glow (A) |
| 02 | Next.js tutorials | Good → **Strong** | `02-nextjs-tutorial.ts` | voiceover `<bookmark/>` sync, TypeWithCursor, lowerThird template, sections |
| 03 | AnimStats | Good → **Strong** | `03-animstats.ts` | statCounter, BarChart + PieChart via chartReveal, plotLineGraph + getArea |
| 04 | Mux data videos | Good → **Strong** | `04-mux.ts` | schema-validated params from an API-shaped JSON fixture, 2 param renders |
| 05 | GitHub Unwrapped | Partial → **Strong** | `05-github-unwrapped.ts` | 5 param-varied jobs through the RENDER SERVICE (S), contribution grid, donut |
| 06 | AdMove | Good → **Strong** | `06-admove.ts` | registerStylePreset brand themes ×2 renders, template flow, 1:1, dropShadow |
| 07 | Supermotion | Partial → **Strong** | `07-supermotion.ts` | two-stage screen-clip ingest (loadVideo), camera-stop auto-zoom on the click |
| 08 | Revid.ai | Good → **Strong** | `08-revid.ts` | socialShort 9:16, SRT CaptionTrack karaoke, Ken-Burns b-roll, tone bed mux |
| 09 | Submagic | Partial → **Strong** | `09-submagic.ts` | WordCaptionTrack word pops (P5), vector-emoji beats, punch-zoom hits |
| 10 | MyKaraoke Video | Good → **Strong** | `10-mykaraoke.ts` | karaoke sweep, bouncing follow-dot, synthesized melody mux |
| 11 | Relay.app explainer | Good → **Strong** | `11-relay.ts` | FlexGroup (Yoga) cards, springTiming stagger, connector Creates, slide() |
| 12 | Hello Météo | Good → **Strong** | `12-hello-meteo.ts` | id-layered SVG animated via `byId()` (P1), params ×2 cities |
| 13 | Electricity Maps | Partial → **Strong** | `13-electricity-maps.ts` | loadGeoJSON choropleth via byName (P4), project()-anchored flow arcs, legend |
| 14 | Watercolor map | Partial → **Strong** | `14-watercolor-map.ts` | per-region wash + blur + noise (A), paper vignette/grain, fbm route (P2) |
| 15 | banger.show | Partial → **Strong** | `15-banger-show.ts` | renderGL + BLOOM (B), FFT band envelopes baked into a GL scene, audio mux |
| 16 | FluidMotion | Good → **Strong** | `16-fluidmotion.ts` | simplex-fbm flow field (P2), ParticleSystem motes (P6), exact time-torus loop |
| 17 | Remotion Recorder | Partial → **Strong (compositing scope)** | `17-remotion-recorder.ts` | screen + webcam-bubble compositing, animated layout switches, captions |
| 18 | VibrantSnap | Good → **Strong (compositing scope)** | `18-vibrantsnap.ts` | declarative zoom events → springy camera, KeyframeTrack cursor spotlight |

**Scope notes (the honest column):** 17 and 18 reproduce the *rendering/
compositing* half of recorder products; actual device/screen capture is a
capture-app concern, out of scope for a rendering engine (same boundary
Remotion itself draws — its Recorder captures in the browser and renders with
the same engine being compared here). Demo 15's kick-drum particles use GL
sphere shockwaves — ParticleSystem is canvas-tier (documented in
`docs/renderers.md`).

## Asset provenance

- `assets/europe-subset.geojson` — 16 countries extracted from
  [Natural Earth](https://www.naturalearthdata.com/) `ne_110m_admin_0_countries`
  (public domain), overseas territories clipped to the European bbox.
- `assets/mux-metrics.json` — hand-written API-shaped fixture (no real data).
- Everything else (screen recordings, audio beds, melodies, beat tracks,
  weather icons) is **generated at demo runtime** into `out/_gen/` — ffmpeg
  lavfi synthesis for audio, stage-1 ecmanim renders for video. No downloaded
  media, no API keys required; TTS defaults to the silent provider.

## CI

`showcase-smoke` (in `.github/workflows/ci.yml`) renders demos 01 (canvas
core), 09 (captions), and 13 (geo) at `ECMANIM_DEMO_QUALITY=low` on every
push — a real end-to-end net over render()/effects/captions/geo. The full
18-demo suite is a manual/local run (`npm run demos:showcase`).

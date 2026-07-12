# Examples gallery

Static, browsable HTML for all 196 demos across the 24 top-level feature
demos and 11 parity-campaign galleries — thumbnails + inline video players,
generated from the same READMEs and directory listings a human would read.

```bash
npm run gallery:build     # (re)generate manifest.json + index.html + one page per category
npm run gallery:thumbs    # extract JPEG thumbnails from whatever's already rendered in out/
npx serve .                # from the REPO ROOT (not examples/) -- see below
```

Then open `/examples/gallery/index.html`.

## How it works

- **`manifest.ts`** scans `examples/*.ts` and `examples/*-parity/`, parses
  each campaign README's `## Scorecard` table (and the top-level README's
  `## Examples` table) for per-demo descriptions, and checks each demo's
  `out/*.mp4` / `thumbs/*.jpg` for existing renders — no demo file is
  imported or executed.
- **`thumbs.ts`** extracts a JPEG thumbnail from each demo that already has a
  rendered `.mp4` (via `ffmpeg`/`ffprobe`, one frame ~40% through), into a
  sibling `thumbs/` dir next to that campaign's `out/`. It never renders a
  demo itself — a demo with no video yet is reported and skipped, not
  rendered on the spot. Re-run any time after rendering more demos; it's
  idempotent (skips thumbnails that already exist).
- **`build.ts`** reads the manifest and writes plain HTML (no client-side JS,
  no framework) — `index.html` plus one `<category>.html` per gallery.
  Demos with a video get an inline `<video controls poster="thumb.jpg">`;
  demos without one show a placeholder with the exact command to render them.

## Serving

Serve the **repo root**, not `examples/` — the top-level `README.md` lives
one level above `examples/`, so it's unreachable if `examples/` is the served
root. Every generated page sets `<base href="/examples/gallery/">`, which
pins relative-link resolution to that fixed path regardless of what the
address bar shows — several static file servers (e.g. `serve`'s clean-URL
redirect, which rewrites `index.html` → `index` or drops it entirely) mangle
plain relative hrefs otherwise.

## Regenerating after new demos land

Re-run `npm run gallery:build` (fast, no rendering) any time a demo is added,
renamed, or its README description changes. Run `npm run gallery:thumbs`
after actually rendering new demos to pick up their thumbnails — it's a
no-op for anything already thumbnailed.

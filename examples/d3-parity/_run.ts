// Shared harness for the D3 parity ports: every demo is a line-for-line
// port of a D3 Observable gallery notebook (original cell JS in ./ref/,
// fixture data in ./data/). demoRender() keeps rendering uniform.
//
//   ECMANIM_DEMO_QUALITY=low|medium|high   (default medium)
//
// Porting conventions (see README.md):
// - D3 scenes live in SVG PIXEL space (y-DOWN, top-left origin, usually
//   928px wide). `svgFrame(width, height)` returns a mapping into ecmanim's
//   y-up world, scaled to fit the 8-unit-tall frame with a small margin:
//   `f.pt(x, y)` for positions, `f.len(n)` for lengths, `f.sw(n)` keeps
//   D3 strokeWidths readable.
// - FileAttachment("x.csv").csv({typed: true}) → `loadCsv("x.csv")`;
//   .json() → `loadJson("x.json")` (reads ./data/).
// - Scales/shapes/layouts come from ../../src/node.ts (scaleLinear,
//   scaleBand, stack, hierarchy, treemap, forceSimulation, sankey, chord,
//   contours, hexbin, feature, dataJoin, ...) — same names as d3.

import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { render } from "../../src/node.ts";
import type { RenderOptions } from "../../src/node.ts";

export const DEMO_QUALITY = process.env.ECMANIM_DEMO_QUALITY ?? "medium";

// --- coordinate bridge -----------------------------------------------------

export interface SvgFrame {
  /** SVG pixel position -> world [x, y, 0]. */
  pt(x: number, y: number): number[];
  /** SVG pixel length -> world units. */
  len(n: number): number;
  /** D3 strokeWidth -> ecmanim strokeWidth (scaled with the fit). */
  sw(n: number): number;
  scale: number;
}

/** Fit an SVG-pixel-space chart (y-down) into the world frame (y-up),
 *  centered, with a 5% margin. World frame is 14.22 x 8 units. */
export function svgFrame(width: number, height: number): SvgFrame {
  const scale = Math.min(14.222 / width, 8 / height) * 0.92;
  return {
    pt: (x: number, y: number) => [(x - width / 2) * scale, (height / 2 - y) * scale, 0],
    len: (n: number) => n * scale,
    // ecmanim strokeWidth ~ px at 1080p; world unit = 135px, so world-scaled
    // stroke = svgPx * scale * 135.
    sw: (n: number) => n * scale * 135,
    scale,
  };
}

// --- fixture loading ---------------------------------------------------------

function dataPath(name: string): string {
  return new URL(`./data/${name}`, import.meta.url).pathname;
}

export function loadJson(name: string): any {
  return JSON.parse(readFileSync(dataPath(name), "utf8"));
}

/** Minimal CSV parser with d3.autoType-style coercion (numbers, ISO dates,
 *  empty -> null). Handles quoted fields with embedded commas/quotes. */
export function loadCsv(name: string): Array<Record<string, any>> {
  const text = readFileSync(dataPath(name), "utf8");
  return parseCsv(text);
}

export function parseCsv(text: string): Array<Record<string, any>> {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); if (row.length > 1 || row[0] !== "") rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") pushField();
    else if (c === "\n") pushRow();
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) pushRow();

  const [header, ...body] = rows;
  return body.map((cells) => {
    const obj: Record<string, any> = {};
    header.forEach((key, i) => { obj[key] = autoType(cells[i] ?? ""); });
    return obj;
  });
}

function autoType(value: string): any {
  const v = value.trim();
  if (v === "") return null;
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return +v;
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(v)) return new Date(v.length === 10 ? v + "T00:00:00Z" : v);
  return v;
}

// --- render ---------------------------------------------------------------------

export function demoOut(metaUrl: string, suffix = ""): string {
  const name = basename(fileURLToPath(metaUrl)).replace(/\.ts$/, "");
  return new URL(`./out/${name}${suffix}.mp4`, import.meta.url).pathname;
}

export async function demoRender(
  sceneOrConstruct: any,
  metaUrl: string,
  options: RenderOptions = {},
): Promise<void> {
  const output = options.output ?? demoOut(metaUrl);
  const t0 = Date.now();
  await render(sceneOrConstruct, {
    quality: DEMO_QUALITY,
    verbose: false,
    // Observable notebooks render on white.
    background: "#ffffff",
    ...options,
    output,
  });
  console.log(`✓ ${basename(output)} (${((Date.now() - t0) / 1000).toFixed(1)}s @ ${(options as any).quality ?? DEMO_QUALITY})`);
}

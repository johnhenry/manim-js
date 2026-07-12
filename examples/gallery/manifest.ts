// Scans examples/ and the top-level README to build a JSON manifest the
// gallery's build.ts (HTML) and thumbs.ts (thumbnail extraction) both read.
// Doesn't touch or import any demo file -- pure filesystem + markdown-table
// parsing, so adding a new demo just means re-running `npm run gallery:build`.

import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = dirname(HERE); // examples/
const REPO_ROOT = dirname(EXAMPLES_DIR);

export interface DemoEntry {
  id: string;
  file: string; // path relative to EXAMPLES_DIR, for display / source links
  name: string; // filename without extension, e.g. "11-treemap"
  description: string;
  video: string | null; // path relative to EXAMPLES_DIR, for <video src>
  thumb: string | null; // path relative to EXAMPLES_DIR, for <img src>
  sourceUrl: string | null; // link to the specific original example this demo recreates, when reliably known
}

export interface Category {
  key: string;
  title: string;
  kind: "feature" | "parity";
  scorecard: string | null;
  readme: string; // path relative to EXAMPLES_DIR
  demos: DemoEntry[];
  sourceUrl: string | null; // the original gallery/site this whole campaign recreates
  sourceLabel: string | null; // display text for sourceUrl
}

// Campaign-wide "recreates X" link shown in each category's header (in
// addition to the per-demo links below, where available). Every URL in this
// file -- here and in the per-demo maps further down -- is either copied
// verbatim from a citation already committed in this repo, mechanically
// derived from a documented template + an already-real filename (see
// d3SourceUrl/lottieSourceUrl/manimSourceUrl), or individually researched
// and HTTP-verified. Never invented: threeb1b-parity/04-sum-of-odds is the
// one demo repo-wide with no link at all, because its own citation is a
// genre ("the visual-proof genre"), not a specific video -- there's nothing
// to verify or link.
const CAMPAIGN_SOURCE: Record<string, { url: string; label: string }> = {
  "manim-parity": { url: "https://docs.manim.community/en/stable/examples.html", label: "docs.manim.community" },
  "showcase-parity": { url: "https://www.remotion.dev/showcase", label: "remotion.dev/showcase" },
  "motion-canvas-parity": { url: "https://motioncanvas.io", label: "motioncanvas.io" },
  "lottie-parity": { url: "https://github.com/airbnb/lottie-web", label: "github.com/airbnb/lottie-web" },
  "mermaid-parity": { url: "https://github.com/mermaid-js/mermaid", label: "github.com/mermaid-js/mermaid" },
};

export interface Manifest {
  generatedAt: string;
  categories: Category[];
}

const DESCRIPTION_COLUMN_PRIORITY = ["proves", "features proven", "shows"];

function findVideoAndThumb(dir: string, name: string): { video: string | null; thumb: string | null } {
  const mp4 = join(dir, "out", `${name}.mp4`);
  const jpg = join(dir, "thumbs", `${name}.jpg`);
  return {
    video: existsSync(mp4) ? relFromExamples(mp4) : null,
    thumb: existsSync(jpg) ? relFromExamples(jpg) : null,
  };
}

function relFromExamples(absPath: string): string {
  return absPath.slice(EXAMPLES_DIR.length + 1);
}

// Parses a GitHub-flavored markdown table immediately following a
// `## Scorecard...` heading. Returns { number -> descriptionText }, choosing
// the column whose header matches DESCRIPTION_COLUMN_PRIORITY (falls back to
// the last column when no header matches -- see manim-parity's README,
// which has no "Proves"/"Features proven" column).
function parseScorecardTable(readmeText: string): { heading: string | null; byNumber: Map<string, string> } {
  const lines = readmeText.split("\n");
  const headingIdx = lines.findIndex((l) => /^## Scorecard/.test(l));
  const byNumber = new Map<string, string>();
  if (headingIdx === -1) return { heading: null, byNumber };
  const heading = lines[headingIdx].replace(/^##\s*/, "");

  const tableLines: string[] = [];
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("|")) tableLines.push(line);
    else if (tableLines.length > 0) break; // table ended
  }
  if (tableLines.length < 2) return { heading, byNumber };

  const cells = (line: string) =>
    line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const header = cells(tableLines[0]).map((h) => h.toLowerCase());
  let descCol = header.length - 1;
  for (const wanted of DESCRIPTION_COLUMN_PRIORITY) {
    const idx = header.findIndex((h) => h.includes(wanted));
    if (idx !== -1) {
      descCol = idx;
      break;
    }
  }

  for (const line of tableLines.slice(2)) {
    // skip the |---|---| separator row
    if (/^\|[\s:-]+\|$/.test(line.replace(/\s/g, "")) && !/\d/.test(line)) continue;
    const row = cells(line);
    const num = row[0]?.replace(/\*/g, "").trim();
    if (!/^\d+$/.test(num ?? "")) continue;
    byNumber.set(num.padStart(2, "0"), row[descCol] ?? "");
  }
  return { heading, byNumber };
}

// Parses a `ref/README.md` provenance table whose rows are
// `| NN | [label](./NN-name.ext) ... | ... | URL |` (echarts-parity,
// gsap-parity, p5-parity all use this exact shape) into { number -> URL }.
// Scans cells right-to-left for the first one containing a bare http(s) URL,
// since the URL is always the last cell but a couple of rows (e.g. p5's 11)
// have trailing parenthetical prose *after* the URL in the same cell.
function parseRefSourceUrls(readmeText: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of readmeText.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const num = cells[0]?.replace(/\*/g, "").trim();
    if (!/^\d+$/.test(num ?? "")) continue;
    for (let i = cells.length - 1; i >= 0; i--) {
      const m = cells[i].match(/https?:\/\/\S+/);
      if (m) {
        map.set(num.padStart(2, "0"), m[0].replace(/[),.]+$/, ""));
        break;
      }
    }
  }
  return map;
}

// d3-parity's ref/ files aren't numbered (bar-chart.js, treemap.js, ...) --
// match by exact basename against the demo's name with its "NN-" prefix
// stripped. ~4/25 demo names don't exactly match their ref file (the demo
// uses a shortened slug, e.g. "radial-stacked-bar" vs. the ref file/real
// Observable slug "radial-stacked-bar-chart") -- rather than guess, those
// were resolved by reading each demo's own header comment (which cites its
// exact ref file) and verifying the resulting URL returns 200; see
// D3_SLUG_OVERRIDES. The https://observablehq.com/@d3/<slug> URL form
// itself is documented in ref/README.md as the exact fetch template these
// files came from.
const D3_SLUG_OVERRIDES: Record<string, string> = {
  "radial-stacked-bar": "radial-stacked-bar-chart",
  "circle-packing": "zoomable-circle-packing",
  "disjoint-force-graph": "disjoint-force-directed-graph",
  "edge-bundling": "hierarchical-edge-bundling",
};
function d3SourceUrl(dir: string, demoName: string): string | null {
  const base = demoName.replace(/^\d+-/, "");
  const slug = D3_SLUG_OVERRIDES[base] ?? base;
  return existsSync(join(dir, "ref", `${slug}.js`)) ? `https://observablehq.com/@d3/${slug}` : null;
}

// lottie-parity's 5 demos (01-bodymovin .. 05-navidad) are real animations
// from github.com/airbnb/lottie-web's demo/<name>/data.json (see
// data/README.md's provenance note) -- the demo's "NN-" stripped name is
// exactly that repo's demo folder name for all 5, verified via GitHub's
// contents API + curl (200) for each.
function lottieSourceUrl(demoName: string): string {
  const base = demoName.replace(/^\d+-/, "");
  return `https://github.com/airbnb/lottie-web/blob/master/demo/${base}/data.json`;
}

// manim-parity's ref/*.py files are named exactly after each demo's class
// name (demo "02-BraceAnnotation.ts" <-> ref/BraceAnnotation.py), and
// docs.manim.community's single-page example gallery uses in-page fragment
// anchors of the form #<lowercase-classname-no-spaces> for every one of
// them -- confirmed present in the page's HTML for all 27, spot-verified
// (200 + matching "Example: <ClassName>" heading) for 7 spread across the
// list.
function manimSourceUrl(demoName: string): string {
  const className = demoName.replace(/^\d+-/, "");
  return `https://docs.manim.community/en/stable/examples.html#${className.toLowerCase()}`;
}

// The remaining campaigns have no derivable filename/URL template -- each
// entry below was individually researched and verified (HTTP 200, content
// checked against the demo's actual citation) rather than pattern-matched.
// See the campaign's own README for what each demo ports; these are NOT
// re-derivable from repo text the way the functions above are.
const MERMAID_SOURCE_URLS: Record<string, string> = {
  "01": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/flowchart.md",
  "02": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/sequenceDiagram.md",
  "03": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/classDiagram.md",
  "04": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/stateDiagram.md",
  "05": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/entityRelationshipDiagram.md",
  "06": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/gantt.md",
  "07": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/pie.md",
  "08": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/userJourney.md",
  "09": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/timeline.md",
  "10": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/mindmap.md",
  "11": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/quadrantChart.md",
  "12": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/gitgraph.md",
  // 13-diagram-diff: both authored flowcharts, not ported from one doc example -- links to the flowchart *syntax* it follows, not "the example this ports".
  "13": "https://github.com/mermaid-js/mermaid/blob/develop/packages/mermaid/src/docs/syntax/flowchart.md",
};

const MOTION_CANVAS_SOURCE_URLS: Record<string, string> = {
  "01": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/quickstart.mdx",
  "02": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/components/bezier.mdx",
  "03": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/components/bezier.mdx",
  "04": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/components/spline.mdx",
  "05": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/components/path.mdx",
  "06": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/camera.mdx",
  "07": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/transitions.mdx",
  "08": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/components/code/index.mdx",
  "09": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/flow.mdx",
  "10": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/advanced/spawners.mdx",
  "11": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/logging.mdx",
  "12": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/time-events.mdx",
  "13": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/advanced/random.mdx",
  "14": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/signals.mdx",
  "15": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/tweening.mdx",
  "16": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/positioning.mdx",
  "17": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/layouts.mdx",
  "18": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/hierarchy.mdx",
  "19": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/media.mdx",
  "20": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/components/latex.mdx",
  "21": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/components/code-block.mdx",
  "22": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/getting-started/effects.mdx",
  "23": "https://github.com/motion-canvas/motion-canvas/blob/main/packages/docs/docs/advanced/filters-and-effects.mdx",
  "24": "https://github.com/motion-canvas/examples/blob/master/examples/logo/src/scenes/logo.tsx",
  "25": "https://github.com/motion-canvas/examples/blob/master/examples/motion-canvas/src/scenes/signals.tsx",
};

const SHOWCASE_SOURCE_URLS: Record<string, string> = {
  "01": "https://www.hackreels.com/",
  "02": "https://twitter.com/delba_oliveira/status/1707439537054535867",
  "03": "https://www.animstats.com/",
  "04": "https://mux.com/blog/visualize-mux-data-with-remotion/",
  "05": "https://githubunwrapped.com/",
  "06": "https://admove.ai/",
  "07": "https://www.supermotion.co",
  "08": "https://www.revid.ai/",
  "09": "https://www.youtube.com/watch?v=hNKola6xpqQ",
  "10": "https://www.mykaraoke.video/",
  "11": "https://www.relay.app/",
  "12": "https://www.instagram.com/hellometeo/",
  "13": "https://www.electricitymaps.com/electricity-mapped",
  "14": "https://www.remotion.pro/watercolor-map",
  "15": "https://banger.show/",
  "16": "https://fluidmotion.app/",
  "17": "https://www.remotion.dev/recorder",
  "18": "https://vibrantsnap.com/",
};

// threeb1b-parity: cited only by video title/year in the README, no URL --
// each of these was found via web search and cross-corroborated against
// 3blue1brown.com's own /lessons/* pages (which embed the canonical video
// per lesson) plus official playlists / third-party listings, not a single
// unverified search hit. Demo 04 (sum-of-odds) is deliberately absent: its
// own citation is "the visual-proof genre", not a specific video -- there is
// nothing to verify or link.
const THREEB1B_SOURCE_URLS: Record<string, string> = {
  "01": "https://www.youtube.com/watch?v=r6sGWTCMz2k",
  "02": "https://www.youtube.com/watch?v=kYB8IZa5AuE",
  "03": "https://www.youtube.com/watch?v=PFDu9oVAE-g",
  "05": "https://www.youtube.com/watch?v=EK32jo7i5LQ",
  "06": "https://www.youtube.com/watch?v=3s7h2MHQtxc",
  "07": "https://www.youtube.com/watch?v=p_di4Zn4wz4",
  "08": "https://www.youtube.com/watch?v=3d6DsjIBzJ4",
  "09": "https://www.youtube.com/watch?v=GNcFjFmqEc8",
  "10": "https://www.youtube.com/watch?v=aircAruvnKk",
};

// reveal-slidev-parity: each mapped to the specific official reveal.js/Slidev
// docs page covering the exact feature it demonstrates (verified via
// WebFetch to actually cover that feature, not just the framework homepage),
// falling back to the real raw.githubusercontent.com source (already cited
// in ref/README.md) only where no framework has an equivalent feature to
// document (06).
const REVEAL_SLIDEV_SOURCE_URLS: Record<string, string> = {
  "01": "https://sli.dev/guide/syntax",
  "02": "https://revealjs.com/auto-animate/",
  "03": "https://revealjs.com/code/",
  "04": "https://revealjs.com/vertical-slides/",
  "05": "https://revealjs.com/backgrounds/",
  "06": "https://raw.githubusercontent.com/slidevjs/slidev/main/demo/starter/slides.md",
};

const PER_DEMO_SOURCE_MAPS: Record<string, Record<string, string>> = {
  "mermaid-parity": MERMAID_SOURCE_URLS,
  "motion-canvas-parity": MOTION_CANVAS_SOURCE_URLS,
  "showcase-parity": SHOWCASE_SOURCE_URLS,
  "threeb1b-parity": THREEB1B_SOURCE_URLS,
  "reveal-slidev-parity": REVEAL_SLIDEV_SOURCE_URLS,
};

const REF_SOURCE_TABLE_CAMPAIGNS = new Set(["echarts-parity", "gsap-parity", "p5-parity"]);

function parityCategory(dirName: string): Category {
  const dir = join(EXAMPLES_DIR, dirName);
  const readmePath = join(dir, "README.md");
  const readmeText = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
  const { heading, byNumber } = parseScorecardTable(readmeText);

  let refUrlsByNumber = new Map<string, string>();
  if (REF_SOURCE_TABLE_CAMPAIGNS.has(dirName)) {
    const refReadmePath = join(dir, "ref", "README.md");
    if (existsSync(refReadmePath)) refUrlsByNumber = parseRefSourceUrls(readFileSync(refReadmePath, "utf8"));
  }

  const files = readdirSync(dir)
    .filter((f) => /^\d+.*\.ts$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const demos: DemoEntry[] = files.map((f) => {
    const name = f.replace(/\.ts$/, "");
    const num = (name.match(/^(\d+)/)?.[1] ?? "").padStart(2, "0");
    const { video, thumb } = findVideoAndThumb(dir, name);
    const sourceUrl =
      dirName === "d3-parity" ? d3SourceUrl(dir, name) :
      dirName === "lottie-parity" ? lottieSourceUrl(name) :
      dirName === "manim-parity" ? manimSourceUrl(name) :
      PER_DEMO_SOURCE_MAPS[dirName]?.[num] ??
      refUrlsByNumber.get(num) ??
      null;
    return {
      id: `${dirName}/${name}`,
      file: `${dirName}/${f}`,
      name,
      description: byNumber.get(num) ?? "",
      video,
      thumb,
      sourceUrl,
    };
  });

  const campaignSource = CAMPAIGN_SOURCE[dirName] ?? null;
  return {
    key: dirName,
    title: dirName.replace(/-parity$/, "").replace(/-/g, " "),
    kind: "parity",
    scorecard: heading,
    readme: `${dirName}/README.md`,
    demos,
    sourceUrl: campaignSource?.url ?? null,
    sourceLabel: campaignSource?.label ?? null,
  };
}

// Parses README.md's `## Examples` table for the loose top-level feature
// demos (examples/*.ts, not inside a *-parity/ subdirectory).
function featureCategory(): Category {
  const readmeText = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
  const lines = readmeText.split("\n");
  const headingIdx = lines.findIndex((l) => /^## Examples$/.test(l));
  const rows = new Map<string, string>(); // filename (no ext) -> description
  if (headingIdx !== -1) {
    for (let i = headingIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith("|")) {
        if (rows.size > 0) break;
        continue;
      }
      const m = line.match(/`examples\/([\w-]+)\.ts`\s*\|\s*(.+?)\s*\|\s*$/);
      if (m) rows.set(m[1], m[2]);
    }
  }

  const files = readdirSync(EXAMPLES_DIR).filter((f) => /\.ts$/.test(f) && !f.startsWith("_"));
  const demos: DemoEntry[] = files.map((f) => {
    const name = f.replace(/\.ts$/, "");
    const { video, thumb } = findVideoAndThumb(EXAMPLES_DIR, name);
    return {
      id: `feature-demos/${name}`,
      file: f,
      name,
      description: rows.get(name) ?? "",
      video,
      thumb,
      sourceUrl: null,
    };
  });

  return {
    key: "feature-demos",
    title: "feature demos",
    kind: "feature",
    scorecard: `${demos.filter((d) => d.video).length}/${demos.length} rendered`,
    sourceUrl: null,
    sourceLabel: null,
    readme: "../README.md",
    demos,
  };
}

export function buildManifest(): Manifest {
  const parityDirs = readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith("-parity"));
  const categories = [featureCategory(), ...parityDirs.map(parityCategory)];
  return { generatedAt: new Date().toISOString(), categories };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const manifest = buildManifest();
  const out = join(HERE, "manifest.json");
  writeFileSync(out, JSON.stringify(manifest, null, 2));
  const totalDemos = manifest.categories.reduce((n, c) => n + c.demos.length, 0);
  const withVideo = manifest.categories.reduce((n, c) => n + c.demos.filter((d) => d.video).length, 0);
  const withThumb = manifest.categories.reduce((n, c) => n + c.demos.filter((d) => d.thumb).length, 0);
  console.log(`manifest.json: ${manifest.categories.length} categories, ${totalDemos} demos (${withVideo} rendered, ${withThumb} thumbnailed)`);
}

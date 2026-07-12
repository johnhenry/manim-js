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
}

export interface Category {
  key: string;
  title: string;
  kind: "feature" | "parity";
  scorecard: string | null;
  readme: string; // path relative to EXAMPLES_DIR
  demos: DemoEntry[];
}

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

function parityCategory(dirName: string): Category {
  const dir = join(EXAMPLES_DIR, dirName);
  const readmePath = join(dir, "README.md");
  const readmeText = existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
  const { heading, byNumber } = parseScorecardTable(readmeText);

  const files = readdirSync(dir)
    .filter((f) => /^\d+.*\.ts$/.test(f))
    .sort((a, b) => parseInt(a) - parseInt(b));

  const demos: DemoEntry[] = files.map((f) => {
    const name = f.replace(/\.ts$/, "");
    const num = (name.match(/^(\d+)/)?.[1] ?? "").padStart(2, "0");
    const { video, thumb } = findVideoAndThumb(dir, name);
    return {
      id: `${dirName}/${name}`,
      file: `${dirName}/${f}`,
      name,
      description: byNumber.get(num) ?? "",
      video,
      thumb,
    };
  });

  return {
    key: dirName,
    title: dirName.replace(/-parity$/, "").replace(/-/g, " "),
    kind: "parity",
    scorecard: heading,
    readme: `${dirName}/README.md`,
    demos,
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
    };
  });

  return {
    key: "feature-demos",
    title: "feature demos",
    kind: "feature",
    scorecard: `${demos.filter((d) => d.video).length}/${demos.length} rendered`,
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

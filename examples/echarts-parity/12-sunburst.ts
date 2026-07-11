// ECharts parity demo 12: ref/12-sunburst.js — "Basic Sunburst" (ECharts
// gallery, Apache-2.0). Nested-ring hierarchical sunburst over a small
// hand-authored family tree (copied verbatim from the ref script below —
// there's no companion JSON fixture for this example, unlike 11's
// les-miserables.json).
//
// Reuses the D3-campaign's hierarchy/partition layer directly — same
// hierarchy()/partition()/arcShape()/radialPoint() as
// examples/d3-parity/12-sunburst.ts (see that file for the full pattern
// this is adapted from). Two adaptations vs. that demo:
//   1. The ref's `data` is an ARRAY of 2 top-level nodes assigned straight
//      to `series.data` (Grandpa, Nancy) rather than a single root object —
//      hierarchy() requires one root, so it's wrapped in a synthetic
//      `{name: 'root', children: data}` (exactly like the D3 demo already
//      wraps flare-2.json's root).
//   2. The value accessor is `d => d.children ? 0 : (d.value ?? 0)`: several
//      non-leaf nodes in this fixture (e.g. "Uncle Leo") carry BOTH an own
//      `value` AND `children` — matching ECharts sunburst semantics, only
//      leaves contribute to the shown proportions, so a parent's own value
//      is ignored once it has children (its slice size is purely the sum of
//      its children's leaf values).

import {
  Scene, Text, Group, hierarchy, partition, arcShape, radialPoint,
  scaleSequential, interpolateRainbow, LaggedStart, FadeIn,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";
import { svgFrame } from "../d3-parity/_run.ts";

// Copied verbatim from ref/12-sunburst.js's `data` literal.
const data = [
  {
    name: "Grandpa",
    children: [
      {
        name: "Uncle Leo",
        value: 15,
        children: [
          { name: "Cousin Jack", value: 2 },
          {
            name: "Cousin Mary",
            value: 5,
            children: [{ name: "Jackson", value: 2 }],
          },
          { name: "Cousin Ben", value: 4 },
        ],
      },
      {
        name: "Father",
        value: 10,
        children: [
          { name: "Me", value: 5 },
          { name: "Brother Peter", value: 1 },
        ],
      },
    ],
  },
  {
    name: "Nancy",
    children: [
      {
        name: "Uncle Nike",
        children: [
          { name: "Cousin Betty", value: 1 },
          { name: "Cousin Jenny", value: 2 },
        ],
      },
    ],
  },
];

class SunburstBasic extends Scene {
  async construct() {
    const width = 1152, height = 1152, margin = 1;
    // ECharts option's radius: [0, '90%'] — outer ring at 90% of the fit.
    const radius = (Math.min(width, height) / 2 - margin) * 0.9;
    const f = svgFrame(width, height);

    const root = hierarchy({ name: "root", children: data })
      .sum((d: any) => (d.children ? 0 : (d.value ?? 0)));
    partition().size([2 * Math.PI, radius])(root);

    // Color by top-level ancestor index over a rainbow (same convention as
    // the D3 sunburst demo).
    const color = scaleSequential([0, root.children!.length], interpolateRainbow);
    root.children!.forEach((c, i) => ((c as any).index = i));
    const fillOf = (d: any) => {
      if (d.depth === 0) return "#dddddd";
      const top = d.ancestors().reverse()[1];
      return top == null ? "#cccccc" : color((top as any).index);
    };

    const rings = new Map<number, Group>();
    const labels = new Group();
    for (const d of root.descendants()) {
      if (d.depth === 0) continue; // don't draw a slice for the synthetic root
      const arc = arcShape({
        innerRadius: f.len(d.y0!),
        outerRadius: f.len(Math.max(d.y0!, d.y1! - 1)),
        startAngle: d.x0!,
        endAngle: d.x1!,
        padAngle: Math.min((d.x1! - d.x0!) / 2, (2 * 1) / radius),
        fillColor: fillOf(d), fillOpacity: 1, strokeColor: "#ffffff", strokeWidth: f.sw(1),
      });
      if (!rings.has(d.depth)) rings.set(d.depth, new Group());
      rings.get(d.depth)!.add(arc);

      // This fixture is small (12 non-root nodes over a total value of 17),
      // so label every slice rather than the D3 demo's "biggest arcs only"
      // area filter (which was tuned for flare-2.json's much larger tree).
      const label = new Text((d.data as any).name, { fontSize: f.len(11), color: "#333333" });
      label.moveTo(radialPoint((d.x0! + d.x1!) / 2, f.len((d.y0! + d.y1!) / 2)));
      labels.add(label);
    }

    const depths = [...rings.keys()].sort((a, b) => a - b);
    this.add(...depths.map((d) => rings.get(d)!));
    await this.play(new LaggedStart(
      depths.map((d) => new FadeIn(rings.get(d)!, { scale: 0.6 })),
      { lagRatio: 0.5, runTime: 2.5 },
    ));
    await this.play(new FadeIn(labels, { runTime: 0.6 }));
    await this.wait(1);
  }
}

await demoRender(SunburstBasic, import.meta.url);

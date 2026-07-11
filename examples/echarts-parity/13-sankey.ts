// ECharts parity demo 13: ref/13-sankey.js — "Basic Sankey" (ECharts
// gallery, Apache-2.0). Small weighted-flow diagram between 6 named nodes
// (a, b, a1, a2, b1, c), copied verbatim from the ref script's `data`/
// `links` literals — there's no companion JSON fixture for this example.
//
// Reuses the D3-campaign's sankey layer directly — same sankey()/
// sankeyLinkHorizontalPoints() as examples/d3-parity/20-sankey.ts (see that
// file for the full pattern this is adapted from). Two adaptations vs. that
// demo:
//   1. This fixture's links reference nodes BY NAME ("source": "a") rather
//      than by numeric index like the D3 demo's energy.json — pass
//      `sankey({nodeId: (d) => d.name, ...})` (src/layout/sankey.ts's
//      `nodeId` option exists precisely for this case; default is
//      `d => d.index`).
//   2. The ref sets `layout: 'none'`, disabling ECharts' iterative
//      position-relaxation pass — mirrored with `sankey({iterations: 0, ...})`.

import {
  Scene, Rectangle, VMobject, Text, Group, VGroup, scaleOrdinal, schemeTableau10,
  sankey, sankeyLinkHorizontalPoints, LaggedStart, AnimationGroup, FadeIn, tweenTo,
} from "../../src/node.ts";
import { demoRender } from "./_run.ts";
import { svgFrame } from "../d3-parity/_run.ts";

// Copied verbatim from ref/13-sankey.js's `data`/`links` literals.
const rawNodes = [
  { name: "a" },
  { name: "b" },
  { name: "a1" },
  { name: "a2" },
  { name: "b1" },
  { name: "c" },
];
const rawLinks = [
  { source: "a", target: "a1", value: 5 },
  { source: "a", target: "a2", value: 3 },
  { source: "b", target: "b1", value: 8 },
  { source: "a", target: "b1", value: 3 },
  { source: "b1", target: "a1", value: 1 },
  { source: "b1", target: "c", value: 2 },
];

class SankeyBasic extends Scene {
  async construct() {
    const width = 760, height = 460;
    const f = svgFrame(width, height);

    const nodes = rawNodes.map((d) => ({ ...d }));
    const links = rawLinks.map((d) => ({ ...d }));
    sankey({
      nodeId: (d: any) => d.name,
      iterations: 0, // ECharts' layout: 'none' — skip position relaxation.
      nodeWidth: 15, nodePadding: 10,
      extent: [[1, 5], [width - 1, height - 5]],
    })({ nodes, links });

    const color = scaleOrdinal(nodes.map((d: any) => d.name), schemeTableau10);

    const rects = new VGroup();
    const labels = new Group();
    for (const d of nodes as any[]) {
      const r = new Rectangle({
        width: f.len(d.x1 - d.x0), height: f.len(d.y1 - d.y0),
        fillColor: color(d.name), fillOpacity: 1, strokeColor: "#000", strokeWidth: f.sw(0.75),
      });
      r.moveTo(f.pt((d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2));
      rects.add(r);
      const lab = new Text(d.name, { fontSize: f.len(13), color: "#333333" });
      const onLeft = d.x0 < width / 2;
      lab.moveTo(f.pt(onLeft ? d.x1 + 6 : d.x0 - 6, (d.y0 + d.y1) / 2));
      lab.shift([(onLeft ? 1 : -1) * lab.getWidth() / 2, 0, 0]);
      labels.add(lab);
    }

    const ribbons = (links as any[]).map((l) => {
      const [p0, c1, c2, p1] = sankeyLinkHorizontalPoints(l);
      const mob = new VMobject({
        strokeColor: color(l.source.name), strokeOpacity: 0.5,
        strokeWidth: f.sw(Math.max(1, l.width)), fillOpacity: 0,
        lineCap: "butt", // round caps would balloon past the node rects
      });
      mob.startNewPath(f.pt(p0[0], p0[1]));
      mob.addCubicBezier(f.pt(c1[0], c1[1]), f.pt(c2[0], c2[1]), f.pt(p1[0], p1[1]));
      mob.strokeEnd = 0; // drawn on during the intro
      return mob;
    });

    this.add(new Group(...ribbons), rects, labels); // links under nodes
    await this.play(new LaggedStart(
      nodes.map((_d: any, i: number) =>
        new AnimationGroup([new FadeIn(rects.submobjects[i]), new FadeIn(labels.submobjects[i])])),
      { lagRatio: 0.1, runTime: 1.2 },
    ));
    // Links draw source->target, staggered by source layer (left to right).
    const order = links.map((_l: any, i: number) => i)
      .sort((a: number, b: number) =>
        (links[a] as any).source.layer - (links[b] as any).source.layer
        || (links[a] as any).y0 - (links[b] as any).y0);
    await this.play(new LaggedStart(
      order.map((i: number) => tweenTo(ribbons[i], { end: 1 }, 1.0)),
      { lagRatio: 0.15, runTime: 3 },
    ));
    await this.wait(1.5);
  }
}

await demoRender(SankeyBasic, import.meta.url);

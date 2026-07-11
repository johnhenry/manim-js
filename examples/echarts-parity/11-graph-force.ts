// ECharts parity demo 11: ref/11-graph-force.js — "Force Layout" (ECharts
// gallery, Apache-2.0). Force-directed character co-occurrence graph (Les
// Miserables), fed by ref/data/les-miserables.json, with a category legend.
//
// Reuses the D3-campaign's force-simulation layer directly — same
// forceSimulation/forceLink/forceManyBody/forceCenter as
// examples/d3-parity/16-force-directed-graph.ts (see that file for the full
// pattern this is adapted from). This fixture differs from that demo's
// miserables.json in three ways: (1) links have no `value` field, so link
// width here is constant rather than sqrt(value)-scaled; (2) nodes carry a
// numeric `category` (not `group`) plus a separate `categories: [{name}]`
// array used for the legend labels; (3) the ref script itself overwrites
// every node's symbolSize to a constant 5 before building `option`, so node
// radius is constant too, not value-scaled. Nodes already carry pre-laid-out
// x/y from ECharts' own settled layout — ForceSimulation honors existing x/y
// as the sim's initial state (see src/layout/force.ts's _initializeNodes),
// so the on-screen settle starts near-converged and drifts to this port's
// own equilibrium as forceManyBody/forceCenter re-relax it live on screen.

import {
  Scene, Circle, Line, VGroup, Legend, scaleOrdinal, schemeTableau10, tween,
  forceSimulation, forceLink, forceManyBody, forceCenter,
} from "../../src/node.ts";
import { demoRender, loadJson } from "./_run.ts";
import { svgFrame } from "../d3-parity/_run.ts";

const graph = loadJson("les-miserables.json");

class GraphForce extends Scene {
  async construct() {
    // Data spans roughly x:[-517,712] y:[-494,522]; give some margin since
    // forceCenter() will re-relax the centroid toward (0,0) as the sim runs.
    const width = 1300, height = 1150;
    const f = svgFrame(width, height);

    const nodes = graph.nodes.map((d: any) => ({ ...d }));
    const links = graph.links.map((d: any) => ({ ...d }));
    const categories: { name: string }[] = graph.categories;

    const color = scaleOrdinal(categories.map((_c, i) => i), schemeTableau10);

    const sim = forceSimulation(nodes, { seed: 1 })
      .force("link", forceLink(links, { id: (d: any) => d.id }))
      .force("charge", forceManyBody())
      .force("center", forceCenter());

    // The ref's viewBox is centered: sim (x, y) -> svg px (x + w/2, y + h/2).
    const P = (x: number, y: number) => f.pt(x + width / 2, y + height / 2);

    const edges = links.map((l: any) => new Line(
      P(l.source.x, l.source.y), P(l.target.x, l.target.y),
      { strokeColor: "#999", strokeOpacity: 0.6, strokeWidth: f.sw(1) },
    ));
    const dots = nodes.map((d: any) => {
      const c = new Circle({
        radius: f.len(5), fillColor: color(d.category), fillOpacity: 1,
        strokeColor: "#fff", strokeWidth: f.sw(1.5),
      });
      c.moveTo(P(d.x, d.y));
      return c;
    });
    this.add(new VGroup(...edges), new VGroup(...dots)); // links under nodes

    const legend = new Legend(
      categories.map((c, i) => ({ label: c.name, color: color(i), shape: "circle" as const })),
      { orientation: "vertical", itemSpacing: 0.32, swatchSize: 0.22, fontSize: 0.28, textColor: "#333333" },
    );
    legend.toCorner([-1, 1, 0], 0.4);
    this.add(legend);

    const reposition = () => {
      links.forEach((l: any, i: number) =>
        edges[i].putStartAndEndOn(P(l.source.x, l.source.y), P(l.target.x, l.target.y)));
      nodes.forEach((d: any, i: number) => dots[i].moveTo(P(d.x, d.y)));
    };

    // Settle: 300 ticks (d3's static-layout count) spread over the tween.
    const TICKS = 300;
    let done = 0;
    await this.play(tween(6, (t) => {
      const target = Math.round(t * TICKS);
      if (target > done) { sim.tick(target - done); done = target; }
      reposition();
    }));
    await this.wait(1.5); // hold the settled network
  }
}

await demoRender(GraphForce, import.meta.url);

// ECharts parity demo 01: ref/01-bar-race.js — "Bar Race" (ECharts gallery,
// Apache-2.0). Ranked bars flip position on an updating dataset via
// `realtimeSort`. Reproduced with the D3-campaign bar-chart-race machinery
// -- dataJoin()/rankFrame()/interpolateFrames() (src/animation/data_join.ts),
// scaleBand() for the rank->row mapping, DecimalNumber for the counting
// value label, rate_functions.linear for the tween -- see
// examples/d3-parity/06-bar-chart-race.ts for the exact wiring pattern this
// follows. The ref's dataset is simpler than that D3 exemplar's (5 flat
// categories A-E, no dates -- just periodic ticks), so a seeded RNG stands
// in for the ref's Math.random() calls (deterministic, per campaign
// convention) and each "tick" is treated as an integer-indexed keyframe fed
// through interpolateFrames for the smooth linear glide between ticks.

import {
  Scene, Rectangle, Group, Text, DecimalNumber, Legend, scaleLinear, scaleBand,
  dataJoin, interpolateFrames, rankFrame, tweenTo, AnimationGroup, rate_functions,
  useRandom,
} from "../../src/node.ts";
import type { Animation } from "../../src/node.ts";
import { demoRender } from "./_run.ts";

const linear = rate_functions.linear;

// Fit an SVG-pixel-space layout (y-down) into ecmanim's y-up world frame --
// same convention as examples/d3-parity/_run.ts's svgFrame, kept local here
// since this campaign's shared harness (_run.ts) doesn't export one and
// this file may only touch itself.
function svgFrame(width: number, height: number) {
  const scale = Math.min(14.222 / width, 8 / height) * 0.92;
  return {
    pt: (x: number, y: number): number[] => [(x - width / 2) * scale, (height / 2 - y) * scale, 0],
    len: (n: number): number => n * scale,
  };
}

const CATEGORIES = ["A", "B", "C", "D", "E"];
const BAR_COLOR = "#5470c6"; // ECharts default series-0 blue
const LABEL_COLOR = "#333333";

type Datum = { key: string; value: number; rank: number };

class BarRace extends Scene {
  async construct() {
    const width = 700, height = 420, barSize = 62, n = CATEGORIES.length, k = 6, dur = 0.18;
    const marginTop = 30, marginRight = 80, marginLeft = 10;
    const f = svgFrame(width, height);
    const rng = useRandom(3);

    // Seed data (ref: 5 random 0-200 values), then several update ticks
    // (ref's `run()`: += rand(0,200), 10% chance a big += rand(0,2000) jump
    // -- the source of the rank flips this demo proves).
    let values = new Map<string, number>(CATEGORIES.map((c) => [c, Math.round(rng.nextFloat() * 200)]));
    const snapshots: Array<Map<string, number>> = [new Map(values)];
    const TICKS = 5;
    for (let t = 0; t < TICKS; t++) {
      const next = new Map(values);
      for (const c of CATEGORIES) {
        const bump = rng.nextFloat() > 0.9
          ? Math.round(rng.nextFloat() * 2000)
          : Math.round(rng.nextFloat() * 200);
        next.set(c, (next.get(c) ?? 0) + bump);
      }
      values = next;
      snapshots.push(new Map(values));
    }

    // Rank-interpolated keyframes between consecutive ticks (linear tween,
    // matching the ref's animationEasingUpdate: 'linear').
    const rawFrames: Array<[number, Map<string, number>]> = [];
    for (let i = 0; i < snapshots.length - 1; i++) {
      rawFrames.push(...interpolateFrames([i, snapshots[i]], [i + 1, snapshots[i + 1]], k));
    }
    rawFrames.push([snapshots.length - 1, snapshots[snapshots.length - 1]]);
    const frames = rawFrames.map(([t, m]) => ({ date: t, data: rankFrame(m, n) }));

    const x = scaleLinear([0, 1], [marginLeft, width - marginRight]);
    const y = scaleBand(Array.from({ length: n }, (_, i) => i), [marginTop, marginTop + barSize * n]).padding(0.15);
    const bw = y.bandwidth();

    const geometry = (d: Datum) => ({
      cx: f.pt((x(0) + x(d.value)) / 2, 0)[0],
      w: f.len(Math.max(0.5, x(d.value) - x(0))),
      cy: f.pt(0, y(d.rank) + bw / 2)[1],
      nameAt: (nw: number): number[] => [f.pt(x(0), y(d.rank) + bw / 2)[0] + nw / 2 + f.len(6), f.pt(0, y(d.rank) + bw / 2)[1], 0],
      valueEdge: f.pt(x(d.value) + 6, y(d.rank) + bw / 2),
    });

    const makeBar = (d: Datum): Group => {
      const g = geometry(d);
      const rect = new Rectangle({ width: g.w, height: f.len(bw), fillColor: BAR_COLOR, fillOpacity: 0.85, strokeWidth: 0 });
      rect.moveTo([g.cx, g.cy, 0]);
      const name = new Text(d.key, { fontSize: f.len(18), weight: "bold", color: LABEL_COLOR });
      name.moveTo(g.nameAt(name.getWidth()));
      const value = new DecimalNumber(d.value, { numDecimalPlaces: 0, fontSize: f.len(15), color: LABEL_COLOR, edgeToFix: [-1, 0, 0] });
      value.moveTo(g.valueEdge, [-1, 0, 0]);
      const bar = new Group(rect, name, value) as any;
      bar.__parts = { rect, name, value };
      return bar;
    };
    const placeBar = (mob: any, d: Datum) => {
      const g = geometry(d);
      const { rect, name, value } = mob.__parts;
      rect.moveTo([g.cx, g.cy, 0]); rect.stretch(g.w / rect.getWidth(), 0);
      name.moveTo(g.nameAt(name.getWidth()));
      value.moveTo(g.valueEdge, [-1, 0, 0]);
    };
    const barTween = (mob: any, d: Datum): Animation => {
      const g = geometry(d);
      const { rect, name, value } = mob.__parts;
      value.setValue(Math.round(d.value));
      const vw = value.getWidth();
      return new AnimationGroup([
        tweenTo(rect, { x: g.cx, y: g.cy, width: g.w }, dur, linear),
        tweenTo(name, { position: g.nameAt(name.getWidth()) }, dur, linear),
        tweenTo(value, { position: [g.valueEdge[0] + vw / 2, g.valueEdge[1], 0] }, dur, linear),
      ]);
    };

    // Title + legend (ref: legend: { show: true }, single series 'X').
    const title = new Text("Bar Race", { fontSize: f.len(20), weight: "bold", color: LABEL_COLOR });
    title.moveTo(f.pt(width / 2, marginTop - 20));
    this.addForegroundMobject(title);
    const legend = new Legend([{ label: "X", color: BAR_COLOR }], { textColor: LABEL_COLOR, fontSize: 0.28 });
    legend.moveTo(f.pt(width - marginRight + 20, marginTop - 20));
    this.addForegroundMobject(legend);

    x.domain([0, frames[0].data[0].value]);
    let join = dataJoin<Datum>([], frames[0].data, (d) => d.key, { make: makeBar });
    this.add(...join.mobs);
    await this.wait(0.4);

    for (let i = 1; i < frames.length; i++) {
      const frame = frames[i];
      x.domain([0, frame.data[0].value]);
      const prev = new Map((frames[i - 1]?.data ?? []).map((d) => [d.key, d]));
      join = dataJoin<Datum>(join.mobs, frame.data, (d) => d.key, {
        make: makeBar,
        update: (mob, d) => barTween(mob, d),
        enterFrom: (mob, d) => placeBar(mob, prev.get(d.key) ?? d),
        runTime: dur,
      });
      const byKey = new Map(frame.data.map((d) => [d.key, d]));
      const enterTweens = join.enter.map((mob) => barTween(mob, byKey.get((mob as any).__joinKey)!));
      await this.play(join.animation, ...enterTweens);
    }
    await this.wait(1);
  }
}

await demoRender(BarRace, import.meta.url, { fps: 20 });

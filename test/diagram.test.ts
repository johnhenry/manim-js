import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDiagram, layoutDiagram, buildBoard, diagram } from "../src/diagram/diagram.ts";

test("parseDiagram reads nodes, labels, and (labeled) edges", () => {
  const g = parseDiagram(`
    A[Start]
    A --> B
    B -- yes --> C
    // a comment
  `);
  assert.deepEqual(g.nodes.map((n) => n.id).sort(), ["A", "B", "C"]);
  assert.equal(g.nodes.find((n) => n.id === "A")!.label, "Start");
  assert.equal(g.nodes.find((n) => n.id === "B")!.label, "B"); // default label = id
  assert.equal(g.edges.length, 2);
  assert.deepEqual(g.edges[0], { from: "A", to: "B", label: undefined });
  assert.deepEqual(g.edges[1], { from: "B", to: "C", label: "yes" });
});

test("layered layout places nodes left→right by depth", () => {
  const g = parseDiagram("A --> B\nB --> C");
  const pos = layoutDiagram(g);
  const ax = pos.get("A")![0], bx = pos.get("B")![0], cx = pos.get("C")![0];
  assert.ok(ax < bx && bx < cx, `x should increase by depth: ${ax},${bx},${cx}`);
});

test("circular layout distributes nodes on a ring", () => {
  const g = parseDiagram("A --> B\nA --> C\nA --> D");
  const pos = layoutDiagram(g, { algorithm: "circular" });
  const radii = ["A", "B", "C", "D"].map((id) => Math.hypot(pos.get(id)![0], pos.get(id)![1]));
  for (const r of radii) assert.ok(r > 0.5);
});

test("buildBoard produces node subgroups + edge arrows tagged with matchId", () => {
  const board: any = buildBoard(parseDiagram("A --> B"));
  const ids = board.submobjects.map((m: any) => m.matchId).filter(Boolean);
  assert.ok(ids.includes("node:A"));
  assert.ok(ids.includes("node:B"));
  assert.ok(ids.includes("edge:A->B"));
  // A node is a VGroup (box + label); an edge is a single mobject.
  const nodeA = board.submobjects.find((m: any) => m.matchId === "node:A");
  assert.ok(nodeA.submobjects.length >= 2);
});

test("diagram() = parse + build in one call", () => {
  const board: any = diagram("X --> Y");
  assert.ok(board.submobjects.some((m: any) => m.matchId === "node:X"));
});

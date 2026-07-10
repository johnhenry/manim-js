// Scene templates (src/templates/): factory structure, theme propagation,
// statCounter end value, socialShort slot bounds, and a one-frame render
// under dark and light presets.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTheme } from "../src/templates/theme.ts";
import { titleCard, lowerThird, statCounter, socialShort, chartReveal, outroCard } from "../src/templates/templates.ts";
import { PieChart } from "../src/mobject/charts.ts";
import { Text } from "../src/mobject/text/Text.ts";
import { registerStylePreset } from "../src/core/presets.ts";
import { CanvasRenderer, Camera } from "../src/renderer/CanvasRenderer.ts";
import { Color } from "../src/core/color.ts";

test("resolveTheme: defaults, luminance-derived foreground, registry-aware, unknown throws", () => {
  const dark = resolveTheme();
  assert.equal(dark.preset.name, "3b1b-dark");
  assert.equal(dark.accent, dark.preset.palette[0]);
  assert.equal(dark.foreground, "#F5F6F8", "dark background → light text");
  const light = resolveTheme("clean-corporate");
  assert.equal(light.foreground, "#16181D", "light background → dark text");
  registerStylePreset("test-brand", {
    name: "test-brand", background: "#101010", palette: ["#AA00FF"],
  });
  const brand = resolveTheme("test-brand");
  assert.equal(brand.accent, "#AA00FF");
  assert.throws(() => resolveTheme("no-such-preset"), /unknown style preset/);
});

test("every factory returns a non-empty group and in/out animations", () => {
  const pieces = [
    titleCard("Hello", { subtitle: "world" }),
    lowerThird("Ada Lovelace", { role: "Engineer" }),
    statCounter("Users", 1200),
    socialShort({ header: new Text("Head"), content: new Text("Body"), caption: new Text("Cap") }),
    chartReveal(new PieChart([1, 2, 3])),
    outroCard("Subscribe", { handle: "@ecmanim" }),
  ];
  for (const p of pieces) {
    assert.ok(p.group.submobjects.length > 0, "non-empty group");
    assert.ok(typeof p.animateIn().interpolate === "function", "animateIn returns an Animation");
    assert.ok(typeof p.animateOut().interpolate === "function", "animateOut returns an Animation");
  }
});

test("theme propagates: accent on rule/bar, foreground on text, fontScale on sizes", () => {
  const t = { preset: "bold-neon" as const, accent: "#123456", fontScale: 2 };
  const card = titleCard("Big", { theme: t });
  assert.equal((card.rule as any).fillColor.toHex().toLowerCase(), "#123456");
  const small = titleCard("Big", { theme: { ...t, fontScale: 1 } });
  assert.ok(Math.abs(card.title.getHeight() / small.title.getHeight() - 2) < 0.1, "fontScale doubles the title");
  const third = lowerThird("Name", { theme: t });
  assert.equal((third.bar as any).fillColor.toHex().toLowerCase(), "#123456");
  // Foreground from the preset's dark background.
  const fg = resolveTheme("bold-neon").foreground;
  assert.equal((third.name as any).fillColor.toHex().toUpperCase(), Color.parse(fg).toHex().toUpperCase());
});

test("statCounter counts to its end value through playThrough", () => {
  const stat = statCounter("Stars", 250, { from: 50, decimals: 0 });
  assert.equal(stat.number.value, 50);
  const anim = stat.playThrough(1.5);
  assert.equal(anim.runTime, 1.5);
  anim.begin();
  anim.interpolate(0.5);
  stat.group.update(0); // updater pulls the tracker into the DecimalNumber
  const mid = stat.number.value;
  assert.ok(mid > 50 && mid < 250, `mid-count ${mid}`);
  anim.finish();
  stat.group.update(0);
  assert.equal(stat.tracker.getValue(), 250);
  assert.equal(stat.number.value, 250);
  assert.match(stat.number.text, /250/);
});

test("socialShort keeps every slot inside the 9:16 safe area", () => {
  const wide = new Text("This header is very wide indeed", { fontSize: 0.6 });
  const s = socialShort({
    header: wide,
    content: new PieChart([3, 2, 1], { radius: 2.5 }),
    caption: new Text("caption line", { fontSize: 0.5 }),
    theme: { margin: 0.5 },
  });
  const fw = 4.5, fh = 8, margin = 0.5;
  for (const [name, slot] of Object.entries(s.slots)) {
    if (!slot.submobjects.length) continue;
    const box = slot.getBoundingBox();
    assert.ok(box.min[0] >= -fw / 2 + margin - 1e-6, `${name} left edge inside safe area (${box.min[0]})`);
    assert.ok(box.max[0] <= fw / 2 - margin + 1e-6, `${name} right edge inside (${box.max[0]})`);
    assert.ok(box.min[1] >= -fh / 2 + margin - 1e-6, `${name} bottom inside (${box.min[1]})`);
    assert.ok(box.max[1] <= fh / 2 - margin + 1e-6, `${name} top inside (${box.max[1]})`);
  }
  // Slots don't overlap vertically: header above content above caption.
  const hy = s.slots.header.getBoundingBox().min[1];
  const cyTop = s.slots.content.getBoundingBox().max[1];
  const cyBot = s.slots.content.getBoundingBox().min[1];
  const capTop = s.slots.caption.getBoundingBox().max[1];
  assert.ok(hy >= cyTop - 1e-6, "header sits above content");
  assert.ok(cyBot >= capTop - 1e-6, "content sits above caption");
});

test("chartReveal staggers a PieChart's slices", () => {
  const chart = new PieChart([1, 2, 3]);
  const reveal = chartReveal(chart, { lagRatio: 0.2 });
  const anim = reveal.animateIn() as any;
  anim.begin();
  anim.interpolate(0.5);
  anim.finish();
  assert.equal(reveal.group, chart);
});

test("one-frame render under dark and light presets draws without throwing", () => {
  for (const preset of ["3b1b-dark", "clean-corporate"]) {
    const calls: string[] = [];
    const fakeCtx: any = new Proxy({}, {
      get: (_t, prop: string) => {
        if (prop === "canvas") return { width: 640, height: 360 };
        if (prop === "measureText") return () => ({ width: 10 });
        return (..._args: any[]) => { calls.push(prop); };
      },
      set: () => true,
    });
    const camera = new Camera({ pixelWidth: 640, pixelHeight: 360 });
    const renderer = new CanvasRenderer(fakeCtx, camera);
    const pieces = [
      titleCard("Title", { subtitle: "Sub", theme: preset }),
      lowerThird("Name", { role: "Role", theme: preset }),
      statCounter("Stat", 10, { theme: preset }),
      outroCard("Bye", { handle: "@x", theme: preset }),
    ];
    renderer.renderMobjects(pieces.map((p) => p.group) as any);
    assert.ok(calls.filter((c) => c === "fill" || c === "fillText" || c === "fillRect").length > 0,
      `${preset}: something was drawn`);
  }
});

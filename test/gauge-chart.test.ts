// GaugeChart (src/mobject/gauge.ts): band-sector construction from a bands
// config, needle angle mapping (min/max/mid), setValue() identity-preserving
// updates (needle rotation + value label text), and custom valueFormat.

import { test } from "node:test";
import assert from "node:assert/strict";
import { GaugeChart } from "../src/mobject/gauge.ts";
import { AnnularSector } from "../src/mobject/arcs.ts";

const EPS = 1e-9;

test("constructs one band sector per band in the config", () => {
  const bands = [
    { to: 20, color: "#67e0e3" },
    { to: 80, color: "#37a2da" },
    { to: 100, color: "#fd666d" },
  ];
  const gauge = new GaugeChart(50, { bands });
  assert.equal(gauge.bandSectors.length, bands.length);
  for (const sector of gauge.bandSectors) {
    assert.ok(sector instanceof AnnularSector);
  }
});

test("falls back to a default 3-band ramp when no bands are configured", () => {
  const gauge = new GaugeChart(50);
  assert.equal(gauge.bandSectors.length, 3);
});

test("needle points at the correct angle for min, max, and a mid value", () => {
  const gauge = new GaugeChart(0, { min: 0, max: 100 });
  assert.ok(Math.abs(gauge.needleAngle - gauge.angleForValue(0)) < EPS);
  assert.ok(Math.abs(gauge.needleAngle - (225 * Math.PI) / 180) < EPS);

  const atMax = new GaugeChart(100, { min: 0, max: 100 });
  assert.ok(Math.abs(atMax.needleAngle - atMax.angleForValue(100)) < EPS);
  assert.ok(Math.abs(atMax.needleAngle - (-45 * Math.PI) / 180) < EPS);

  const atMid = new GaugeChart(50, { min: 0, max: 100 });
  assert.ok(Math.abs(atMid.needleAngle - atMid.angleForValue(50)) < EPS);
  // Midpoint of a 225deg -> -45deg sweep is 90deg.
  assert.ok(Math.abs(atMid.needleAngle - (90 * Math.PI) / 180) < EPS);
});

test("setValue() updates the needle angle and value label text", () => {
  const gauge = new GaugeChart(0, { min: 0, max: 100 });
  const needle = gauge.needle;
  const label = gauge.valueLabel!;

  gauge.setValue(75);
  assert.equal(gauge.needle, needle, "needle mobject keeps its identity");
  assert.equal(gauge.valueLabel, label, "value label mobject keeps its identity");
  assert.ok(Math.abs(gauge.needleAngle - gauge.angleForValue(75)) < EPS);
  assert.equal(label.text, "75");
});

test("setValue() does not throw across repeated random calls and ends in a consistent state", () => {
  const gauge = new GaugeChart(0, { min: 0, max: 100 });
  let last = 0;
  assert.doesNotThrow(() => {
    for (let i = 0; i < 20; i++) {
      last = Math.random() * 100;
      gauge.setValue(last);
    }
  });
  assert.equal(gauge.value, last);
  assert.ok(Math.abs(gauge.needleAngle - gauge.angleForValue(last)) < EPS);
  assert.equal(gauge.valueLabel!.text, last.toFixed(0));
});

test("setValue() clamps out-of-range values silently instead of throwing", () => {
  const gauge = new GaugeChart(0, { min: 0, max: 100 });
  assert.doesNotThrow(() => gauge.setValue(150));
  assert.equal(gauge.value, 100);
  assert.doesNotThrow(() => gauge.setValue(-50));
  assert.equal(gauge.value, 0);
});

test("value label respects a custom valueFormat, at construction and after setValue()", () => {
  const gauge = new GaugeChart(42, {
    min: 0,
    max: 100,
    valueFormat: (v) => `${v.toFixed(1)}%`,
  });
  assert.equal(gauge.valueLabel!.text, "42.0%");
  gauge.setValue(7.25);
  assert.equal(gauge.valueLabel!.text, "7.3%");
});

test("showValueLabel: false omits the center value label", () => {
  const gauge = new GaugeChart(50, { showValueLabel: false });
  assert.equal(gauge.valueLabel, null);
  assert.doesNotThrow(() => gauge.setValue(10));
});

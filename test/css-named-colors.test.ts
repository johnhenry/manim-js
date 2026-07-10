// Color.parse used to silently produce BLACK for CSS named colors
// ("lightseagreen") -- found by the Motion Canvas parity ports, which use
// them heavily. The full CSS named-color table now resolves.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Color } from "../src/core/color.ts";

test("CSS named colors parse to their spec hex values", () => {
  assert.equal(Color.parse("lightseagreen").toHex().toLowerCase(), "#20b2aa");
  assert.equal(Color.parse("LightCoral").toHex().toLowerCase(), "#f08080");
  assert.equal(Color.parse("rebeccapurple").toHex().toLowerCase(), "#663399");
  assert.equal(Color.parse("white").toHex().toLowerCase(), "#ffffff");
});

test("hex strings and registered palette names still win", () => {
  assert.equal(Color.parse("#123456").toHex().toLowerCase(), "#123456");
  // manim palette names (registered via plugins) are uppercase; the CSS
  // table only catches what the registry doesn't.
  assert.equal(Color.parse("#e13238").toHex().toLowerCase(), "#e13238");
});

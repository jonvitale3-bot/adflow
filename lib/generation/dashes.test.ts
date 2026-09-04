import assert from "node:assert/strict";
import { test } from "node:test";

import { hasDash, stripDashes } from "./dashes.ts";

const EM = "—";
const EN = "–";

test("spots both dashes and leaves hyphens alone", () => {
  assert.ok(hasDash(`Storage, fuel ${EM} one stop`));
  assert.ok(hasDash(`Open 9 ${EN} 5`));
  assert.ok(!hasDash("Full-service marina with dry-stack racks"));
});

test("the substitution reads as a sentence", () => {
  assert.equal(
    stripDashes(`60 wet slips ${EM} plus non-ethanol fuel and ice.`),
    "60 wet slips, plus non-ethanol fuel and ice.",
  );
});

test("does not leave a comma against punctuation that already separates", () => {
  assert.equal(stripDashes(`Bay Pines ${EM}, St. Pete`), "Bay Pines, St. Pete");
  assert.equal(stripDashes(`one stop ${EM}. Then the water.`), "one stop. Then the water.");
});

test("a pair of dashes does not leave a double comma", () => {
  assert.equal(
    stripDashes(`The run is quiet ${EM} flat water ${EM} right up to the pass.`),
    "The run is quiet, flat water, right up to the pass.",
  );
});

test("a dash ending a line does not leave a trailing comma", () => {
  assert.equal(stripDashes(`Reserve a rack ${EM}\nCall today`), "Reserve a rack\nCall today");
});

test("copy with no dash is returned untouched", () => {
  const clean = "Dry stack, wet slips, and a tiki bar.\n\n👇 Reserve a rack";
  assert.equal(stripDashes(clean), clean);
});

test("whatever it does, no dash survives", () => {
  // The point of this function is that it is a guarantee, not that it is good.
  for (const text of [
    `a ${EM} b`,
    `a${EM}b`,
    `${EM} leading`,
    `trailing ${EM}`,
    `${EN}${EM}${EN}`,
    `Rated 4.7 ${EN} 157 reviews ${EM} see for yourself.`,
  ]) {
    assert.ok(!hasDash(stripDashes(text)), `survived: ${text}`);
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { FRAMINGS, selectFramings } from "./framing.ts";

test("a batch uses every framing once before repeating any", () => {
  const picked = selectFramings(FRAMINGS.length);
  assert.equal(new Set(picked.map((f) => f.id)).size, FRAMINGS.length);
});

test("a small batch has no repeats at all", () => {
  // Six images was the batch that came back looking like one image.
  const picked = selectFramings(6);
  assert.equal(new Set(picked.map((f) => f.id)).size, 6);
});

test("asking for more than there are repeats rather than running out", () => {
  const picked = selectFramings(FRAMINGS.length + 3);
  assert.equal(picked.length, FRAMINGS.length + 3);
});

test("the order is not the order they are declared in", () => {
  // A fixed order would put the same framing on image 1 of every batch.
  const reversing = (() => {
    let i = 0;
    return () => [0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6][i++ % 7]!;
  })();

  const picked = selectFramings(FRAMINGS.length, reversing);
  assert.notDeepEqual(
    picked.map((f) => f.id),
    FRAMINGS.map((f) => f.id),
  );
});

test("every framing says something about distance or angle", () => {
  // A framing that does not move the camera is not a framing.
  for (const framing of FRAMINGS) {
    assert.ok(framing.text.length > 40, `${framing.id} is too vague to change a shot`);
  }
});

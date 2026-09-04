import assert from "node:assert/strict";
import { test } from "node:test";

import { mayReframe } from "./placement.ts";

test("a clean photograph may be reframed for each placement", () => {
  assert.equal(mayReframe(false), true);
});

test("an image carrying its own headline is never cropped by Meta", () => {
  assert.equal(mayReframe(true), false);
});

test("an unexamined image is left alone rather than assumed safe", () => {
  assert.equal(mayReframe(null), false);
  assert.equal(mayReframe(undefined), false);
});

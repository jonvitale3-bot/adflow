import assert from "node:assert/strict";
import { test } from "node:test";

import { businessLabel, envNameFor, isValidBusinessKey } from "./business-keys.ts";

test("business keys are restricted to safe env-name characters", () => {
  assert.equal(isValidBusinessKey("default"), true);
  assert.equal(isValidBusinessKey("engage"), true);
  assert.equal(isValidBusinessKey("portfolio_2"), true);
  assert.equal(isValidBusinessKey("second-bm"), true);

  // A key becomes part of an env var name, so nothing exotic gets in.
  assert.equal(isValidBusinessKey(""), false);
  assert.equal(isValidBusinessKey("Has Spaces"), false);
  assert.equal(isValidBusinessKey("UPPER"), false);
  assert.equal(isValidBusinessKey("_leading"), false);
  assert.equal(isValidBusinessKey("a".repeat(40)), false);
});

test("the default key maps to the plain variable, others get a suffix", () => {
  assert.equal(envNameFor("default"), "META_ACCESS_TOKEN");
  assert.equal(envNameFor("engage"), "META_ACCESS_TOKEN_ENGAGE");
  assert.equal(envNameFor("second-bm"), "META_ACCESS_TOKEN_SECOND_BM");
});

test("labels are readable", () => {
  assert.equal(businessLabel("default"), "Default portfolio");
  assert.equal(businessLabel("engage"), "Engage");
  assert.equal(businessLabel("second_bm"), "Second bm");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { ClientFormSchema, suggestedAdCategory, fieldErrors } from "./validation.ts";

const base = { name: "Test Client", industry: "boat_club" as const };

function parse(over: Record<string, unknown> = {}) {
  return ClientFormSchema.safeParse({ ...base, ...over });
}

test("a minimal valid client passes", () => {
  assert.equal(parse().success, true);
});

test("name is required", () => {
  assert.equal(parse({ name: "  " }).success, false);
});

test("ad account id must carry the act_ prefix", () => {
  assert.equal(parse({ meta_ad_account_id: "1092447731" }).success, false);
  assert.equal(parse({ meta_ad_account_id: "act_1092447731" }).success, true);
  // Empty is allowed — a client can exist before it is connected.
  assert.equal(parse({ meta_ad_account_id: "" }).success, true);
});

test("marina requires a business type", () => {
  const bad = parse({ industry: "marina" });
  assert.equal(bad.success, false);
  if (!bad.success) {
    assert.equal(fieldErrors(bad.error).marine_business_type !== undefined, true);
  }
  assert.equal(parse({ industry: "marina", marine_business_type: "wet_slips" }).success, true);
});

test("a non-marina does not require a business type", () => {
  assert.equal(parse({ industry: "med_spa" }).success, true);
});

test("IDs are digits only", () => {
  assert.equal(parse({ meta_pixel_id: "abc123" }).success, false);
  assert.equal(parse({ meta_page_id: "102884471120397" }).success, true);
});

test("a bare domain is an acceptable landing page URL", () => {
  assert.equal(parse({ landing_page_url: "learn.carefreeboats.com/lake-norman" }).success, true);
  assert.equal(parse({ landing_page_url: "https://example.com" }).success, true);
  assert.equal(parse({ landing_page_url: "not a url at all" }).success, false);
});

test("regulated industries suggest the right Meta special ad category", () => {
  assert.equal(suggestedAdCategory("finance"), "credit");
  assert.equal(suggestedAdCategory("insurance"), "credit");
  assert.equal(suggestedAdCategory("real_estate"), "housing");
  assert.equal(suggestedAdCategory("boat_club"), "none");
});

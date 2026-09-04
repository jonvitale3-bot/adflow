import assert from "node:assert/strict";
import { test } from "node:test";

import { guardOffer, looksLikeSpecificOffer } from "./offer-guard.ts";

type Values = { offer_description: string; market_name: string };
const v = (offer: string): Values => ({ offer_description: offer, market_name: "Tampa, FL" });

const SPECIFIC = [
  "20% off your first rental",
  "$500 off initiation",
  "Save $200 this month",
  "Limited time only",
  "Offer expires Friday",
  "First month free",
];

const GENERIC = [
  "Book a consultation",
  "Request a quote for coverage",
  "Schedule a water test",
  "Start a membership enquiry",
];

test("a specific offer inferred from the name alone is stripped", () => {
  // There is no source it could have come from, so it was invented.
  for (const offer of SPECIFIC) {
    const r = guardOffer(v(offer), { sourcedFromPage: false });
    assert.equal(r.verdict, "stripped", offer);
    assert.equal(r.values.offer_description, "");
  }
});

test("a specific offer read from the page is KEPT and flagged", () => {
  // This is the case that matters: the offer is most likely quoted from the
  // client's own landing page, and blanking it discards the best thing on it.
  for (const offer of SPECIFIC) {
    const r = guardOffer(v(offer), { sourcedFromPage: true });
    assert.equal(r.verdict, "needs_confirming", offer);
    assert.equal(r.values.offer_description, offer);
  }
});

test("a generic action is clean from either source", () => {
  for (const offer of GENERIC) {
    assert.equal(guardOffer(v(offer), { sourcedFromPage: true }).verdict, "clean");
    assert.equal(guardOffer(v(offer), { sourcedFromPage: false }).verdict, "clean");
  }
});

test("other fields are never touched", () => {
  const r = guardOffer(v("10% off"), { sourcedFromPage: false });
  assert.equal(r.values.market_name, "Tampa, FL");
});

test("detection covers prices, percentages and deadlines", () => {
  assert.equal(looksLikeSpecificOffer("$99 install"), true);
  assert.equal(looksLikeSpecificOffer("15% off"), true);
  assert.equal(looksLikeSpecificOffer("ends Friday"), true);
  assert.equal(looksLikeSpecificOffer("Book a free consultation"), false);
});

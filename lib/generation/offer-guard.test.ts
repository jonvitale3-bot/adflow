import assert from "node:assert/strict";
import { test } from "node:test";

import { stripInventedOffer } from "./offer-guard.ts";

type AutofillValues = {
  market_name: string;
  boating_style: string;
  environment_style: string;
  business_type_description: string;
  offer_description: string;
  tone_keywords: string;
};

function v(offer: string): AutofillValues {
  return {
    market_name: "Charlotte, NC",
    boating_style: "",
    environment_style: "",
    business_type_description: "",
    offer_description: offer,
    tone_keywords: "warm, confident",
  };
}

/**
 * Rule 8 in docs/SPEC.md: the original autofill once fabricated a "20% off
 * first-time renter discount" that did not exist. These pin the backstop.
 */

test("a fabricated percentage discount is stripped", () => {
  const r = stripInventedOffer(v("20% off your first rental"));
  assert.equal(r.stripped, true);
  assert.equal(r.values.offer_description, "");
});

test("a fabricated dollar amount is stripped", () => {
  assert.equal(stripInventedOffer(v("$500 off initiation")).stripped, true);
  assert.equal(stripInventedOffer(v("Save $200 this month")).stripped, true);
});

test("fabricated urgency is stripped", () => {
  for (const offer of [
    "Limited time only",
    "Offer expires Friday",
    "This week only",
    "First month free",
  ]) {
    assert.equal(stripInventedOffer(v(offer)).stripped, true, offer);
  }
});

test("a generic action is kept — that is the correct output", () => {
  for (const offer of [
    "Book a consultation",
    "Request a quote for coverage",
    "Start a membership enquiry",
    "Schedule a tour of the marina",
  ]) {
    const r = stripInventedOffer(v(offer));
    assert.equal(r.stripped, false, offer);
    assert.equal(r.values.offer_description, offer);
  }
});

test("stripping leaves the other fields untouched", () => {
  const r = stripInventedOffer(v("10% off"));
  assert.equal(r.values.market_name, "Charlotte, NC");
  assert.equal(r.values.tone_keywords, "warm, confident");
});

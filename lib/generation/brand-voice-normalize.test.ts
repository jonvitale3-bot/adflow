import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeBrandVoice } from "./brand-voice-normalize.ts";

test("dashes do not survive into the fields the copy prompt splices in", () => {
  const out = normalizeBrandVoice({
    brand_voice: "Plain-spoken, benefit-first — it sells freedom from hassle rather than status.",
    key_phrases: "All the fun — none of the headaches\nWhy Our Customers Love Us!",
    never_say: "Luxury\nElite — exclusive framing\n",
  });

  for (const value of Object.values(out)) {
    assert.doesNotMatch(value, /[–—]/, value);
  }
  assert.equal(out.brand_voice, "Plain-spoken, benefit-first, it sells freedom from hassle rather than status.");
  assert.equal(out.key_phrases, "All the fun, none of the headaches\nWhy Our Customers Love Us!");
});

test("blank lines are dropped from the lists", () => {
  const out = normalizeBrandVoice({
    brand_voice: "x",
    key_phrases: "\n\nOne\n\n  Two  \n",
    never_say: "\n",
  });
  assert.equal(out.key_phrases, "One\nTwo");
  assert.equal(out.never_say, "");
});

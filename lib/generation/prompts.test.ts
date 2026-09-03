import assert from "node:assert/strict";
import { test } from "node:test";

import { buildBrandContext, buildSystemPrompt, type CopyPromptInput } from "./prompts.ts";
import { pairWithCreatives } from "./pairing.ts";

function input(over: Partial<CopyPromptInput> = {}): CopyPromptInput {
  return {
    clientName: "Carefree Boat Club - South Florida",
    locationDescription: "South Florida, Biscayne Bay",
    industry: "boat_club",
    seasonType: "seasonal",
    brand: {},
    count: 20,
    timeZone: "America/New_York",
    now: new Date("2026-06-15T12:00:00Z"),
    ...over,
  };
}

test("boat club prompt carries the bans that define the product", () => {
  const p = buildSystemPrompt(input());
  assert.match(p, /NEVER compare cost of membership vs\. cost of boat ownership/);
  assert.match(p, /Never use vague social proof numbers/);
  assert.match(p, /Maximum 7 lines total/);
  assert.match(p, /Maximum 10 words per line/);
  assert.match(p, /BANNED line 5 patterns/);
  assert.match(p, /NEVER use the words "click", "tap", "instant access"/);
  assert.match(p, /4-6 words, plain English/);
});

test("non-boat-club industries get the generic prompt, not the boat club one", () => {
  const p = buildSystemPrompt(input({ industry: "med_spa", clientName: "Glow Med Spa" }));
  assert.doesNotMatch(p, /membership boat club/);
  assert.doesNotMatch(p, /cost of boat ownership/);
  assert.match(p, /BUSINESS: Glow Med Spa/);
  // Shared rules must still be present.
  assert.match(p, /Maximum 7 lines total/);
  assert.match(p, /NEVER use the words "click", "tap"/);
});

test("brand context is labelled with the client's brand, not a hardcoded one", () => {
  // The old build labelled every client's voice block "CAREFREE BRAND VOICE"
  // because brand settings were one global row (docs/SPEC.md §9 rule 25).
  const ctx = buildBrandContext({ brandVoice: "Calm and clinical." }, "Glow Med Spa");
  assert.match(ctx, /GLOW MED SPA BRAND VOICE:/);
  assert.doesNotMatch(ctx, /CAREFREE/);
});

test("brand voice is truncated to 2000 chars", () => {
  const ctx = buildBrandContext({ brandVoice: "x".repeat(5000) }, "Brand");
  assert.ok(ctx.length < 2200, `brand context was ${ctx.length} chars`);
});

test("empty brand settings fall back to the default boat club voice", () => {
  const p = buildSystemPrompt(input({ brand: {} }));
  assert.match(p, /Aspirational but accessible/);
});

test("supplied brand voice replaces the default", () => {
  const p = buildSystemPrompt(input({ brand: { brandVoice: "Terse and nautical." } }));
  assert.match(p, /Terse and nautical\./);
  assert.doesNotMatch(p, /Aspirational but accessible/);
});

test("the requested count reaches the prompt", () => {
  assert.match(buildSystemPrompt(input({ count: 37 })), /exactly 37 variations/);
});

test("creative pairing is deterministic regardless of input order", () => {
  const creatives = [
    { id: "c", created_at: "2026-01-03" },
    { id: "a", created_at: "2026-01-01" },
    { id: "b", created_at: "2026-01-02" },
  ];
  const first = pairWithCreatives(5, creatives);
  const shuffled = pairWithCreatives(5, [...creatives].reverse());
  assert.deepEqual(first, shuffled, "pairing must not depend on row order");
  assert.deepEqual(first, ["a", "b", "c", "a", "b"]);
});

test("pairing yields nulls when the client has no creatives", () => {
  assert.deepEqual(pairWithCreatives(3, []), [null, null, null]);
});

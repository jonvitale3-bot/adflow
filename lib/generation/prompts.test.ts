import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBrandContext,
  buildSystemPrompt,
  buildUserMessage,
  type CopyPromptInput,
} from "./prompts.ts";
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

test("image pairing stays OUT of the cached system prompt", () => {
  // The list changes every request. In the system prompt it would invalidate
  // the cache on every call.
  const withImages = buildSystemPrompt(
    input({ pairedImages: ["Cruising at golden hour", "Fishing at sunrise"] }),
  );
  const without = buildSystemPrompt(input());
  assert.equal(withImages, without, "system prompt must not vary with the image list");
});

test("image pairing appears in the user message, numbered in order", () => {
  const msg = buildUserMessage(
    input({ pairedImages: ["Cruising at golden hour", "Fishing at sunrise"] }),
  );
  assert.match(msg, /IMAGE PAIRING/);
  assert.match(msg, /1\. Cruising at golden hour/);
  assert.match(msg, /2\. Fishing at sunrise/);
  assert.match(msg, /Variation 1 runs with image 1/);
});

test("a variation with no image is told to stand alone", () => {
  const msg = buildUserMessage(input({ pairedImages: ["A dock at sunset", null] }));
  assert.match(msg, /2\. \(no image — write it standalone\)/);
});

test("no image descriptions means no pairing section at all", () => {
  assert.doesNotMatch(buildUserMessage(input()), /IMAGE PAIRING/);
  assert.doesNotMatch(buildUserMessage(input({ pairedImages: [null, null] })), /IMAGE PAIRING/);
});

test("copy is told not to repeat text already baked into the image", () => {
  // Finished creatives often carry their own headline, offer badge or review.
  // Restating it wastes the few lines an ad gets.
  const msg = buildUserMessage(
    input({ pairedImages: ["A softener install with a $75 off badge and a five-star review"] }),
  );
  assert.match(msg, /do NOT repeat it/);
  assert.match(msg, /adding what the image does not say/);
});

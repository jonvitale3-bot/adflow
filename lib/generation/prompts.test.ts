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
  assert.match(p, /under 90 words/);
  assert.match(p, /Adventure awaits/);
  assert.match(p, /NEVER use the words "click", "tap", "instant access"/);
  assert.match(p, /4-6 words, plain English/);
});

test("the prompt teaches flow, not a line-by-line form", () => {
  const p = buildSystemPrompt(input());
  // The old prompt assigned each line a job and banned commas between ideas,
  // which is what made every ad read as a stack of clipped fragments.
  assert.doesNotMatch(p, /Line 1:/);
  assert.doesNotMatch(p, /Periods used to separate ideas within a line/);
  assert.doesNotMatch(p, /Maximum 10 words per line/);
  assert.match(p, /ONE argument per ad/);
  assert.match(p, /Vary sentence length/);
  assert.match(p, /Connect the ideas/);
});

test("the example the model imitates is written as prose, not fragments", () => {
  const p = buildSystemPrompt(input());
  // Whatever else the prompt says, the model copies the exemplar. It has to
  // contain connective grammar rather than a run of full stops.
  const example = /One membership, and the boat is ready when you are[\s\S]*?See membership options near you/.exec(p);
  assert.ok(example, "the boat club exemplar is missing");
  assert.match(example[0], /, so |, and /);
});

test("the prompt contains no dash it tells the model not to use", () => {
  // The model imitates the prose it is given far more reliably than it obeys a
  // rule stated once, so a prompt that bans em dashes while using them in its
  // own headings gets em dashes back.
  for (const p of [buildSystemPrompt(input()), buildSystemPrompt(input({ industry: "marina" }))]) {
    const offenders = p
      .split("\n")
      .filter((line) => /[\u2013\u2014]/.test(line))
      .filter((line) => !line.includes("NEVER use an em dash"));
    assert.deepEqual(offenders, [], "the prompt uses the punctuation it forbids");
  }
});

test("non-boat-club industries get the generic prompt, not the boat club one", () => {
  const p = buildSystemPrompt(input({ industry: "med_spa", clientName: "Glow Med Spa" }));
  assert.doesNotMatch(p, /membership boat club/);
  assert.doesNotMatch(p, /cost of boat ownership/);
  assert.match(p, /BUSINESS: Glow Med Spa/);
  // Shared rules must still be present.
  assert.match(p, /under 90 words/);
  assert.match(p, /ONE argument per ad/);
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
  assert.match(msg, /2\. \(no image, write it standalone\)/);
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

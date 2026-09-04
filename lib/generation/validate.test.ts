import assert from "node:assert/strict";
import { test } from "node:test";

import type { AdVariation } from "./schema.ts";
import { validateBoatClubVariation, validateVariation } from "./validate.ts";

function v(over: Partial<AdVariation> = {}): AdVariation {
  return {
    headline: "Boating Without The Headaches",
    primary_text:
      "One membership. Unlimited adventures.\nExplore the Space Coast and Crystal River.\n\nCruise open water. Fish springs. Enjoy watersports.\nNo maintenance. No storage. No insurance.\n\nFour marinas. One membership. Boats ready Friday.\n👇 Join now before summer fills up",
    angle: "lifestyle",
    ...over,
  };
}

const rules = (ws: { rule: string }[]) => ws.map((w) => w.rule);

test("a compliant variation produces no warnings", () => {
  assert.deepEqual(validateBoatClubVariation(v()), []);
});

test("headline outside 4-6 words is flagged", () => {
  assert.ok(rules(validateVariation(v({ headline: "Boating" }))).includes("headline_length"));
  assert.ok(
    rules(validateVariation(v({ headline: "One Two Three Four Five Six Seven" })))
      .includes("headline_length"),
  );
});

test("a sentence that carries an idea is not a rule violation", () => {
  // The per-line word cap used to flag this. It is the shape good copy takes.
  const flowing = v({
    primary_text:
      "Owning a boat in Florida means half your weekends go to the boat instead of to the water.\n\n👇 Reserve rack space for the season",
  });
  assert.deepEqual(rules(validateVariation(flowing)), []);
});

test("an ad too long to read before \"... more\" is flagged", () => {
  const long = v({ primary_text: Array.from({ length: 95 }, () => "word").join(" ") });
  assert.ok(rules(validateVariation(long)).includes("primary_text_length"));
});

test("more than 7 lines is flagged", () => {
  const many = v({ primary_text: Array.from({ length: 9 }, (_, i) => `line ${i}`).join("\n") });
  assert.ok(rules(validateVariation(many)).includes("primary_text_lines"));
});

test("banned CTA verbs are flagged", () => {
  for (const cta of ["👇 Click here to learn more", "Tap for instant access"]) {
    const bad = v({ primary_text: `Hook line here.\n${cta}` });
    assert.ok(rules(validateVariation(bad)).includes("cta_banned_term"), `missed: ${cta}`);
  }
});

test("naming a month is flagged — ads outlive the month", () => {
  const bad = v({ primary_text: "Book your July weekend now.\n👇 Join today" });
  assert.ok(rules(validateVariation(bad)).includes("month_named"));
});

test("numeric social proof is flagged", () => {
  const bad = v({ primary_text: "Over 500 members boat weekly.\n👇 Join today" });
  assert.ok(rules(validateVariation(bad)).includes("numeric_social_proof"));
});

test("qualitative social proof is NOT flagged", () => {
  const ok = v({
    primary_text: "Members across Central Florida chose us.\n👇 Join now before summer fills",
  });
  assert.ok(!rules(validateVariation(ok)).includes("numeric_social_proof"));
});

test("motivational filler is flagged wherever it appears", () => {
  // It used to be policed only at line 5, which no longer exists now that copy
  // is written as paragraphs rather than a six-slot form.
  for (const text of [
    "Adventure awaits.\n👇 Join now today",
    "a b c.\nd e f.\n\ng h i.\nj k l.\n\nAdventure awaits\n👇 Join now today",
  ]) {
    assert.ok(rules(validateVariation(v({ primary_text: text }))).includes("platitude"), text);
  }
});

test("cost-vs-ownership comparison is boat-club only", () => {
  const bad = v({ primary_text: "Cheaper than owning a boat.\n👇 Join now today" });
  assert.ok(rules(validateBoatClubVariation(bad)).includes("cost_comparison"));
  // The generic validator does not carry this rule — it is a boat-club product
  // decision, not a universal one.
  assert.ok(!rules(validateVariation(bad)).includes("cost_comparison"));
});

test("exclamation marks are flagged", () => {
  assert.ok(
    rules(validateVariation(v({ primary_text: "Get on the water!\n👇 Join now" })))
      .includes("exclamation"),
  );
});

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

test("a dash is flagged wherever it appears", () => {
  const inBody = v({ primary_text: "Call ahead \u2014 the boat is waiting.\n\u2028👇 Reserve a rack" });
  assert.ok(rules(validateVariation(inBody)).includes("dash"));

  const inHeadline = v({ headline: "Dry Storage \u2013 No Hassle" });
  assert.ok(rules(validateVariation(inHeadline)).includes("dash"));
});

test("an ordinary hyphen is not a dash", () => {
  const fine = v({ primary_text: "Full-service marina, dry-stack racks.\n👇 Reserve a rack" });
  assert.ok(!rules(validateVariation(fine)).includes("dash"));
});

// The rule this replaces matched a digit sitting directly against a noun, so
// it flagged a real review count and allowed every phrase the brand rules ban
// by name. These cases are taken from those rules.
test("an unverifiable count of people is flagged", () => {
  for (const text of [
    "Hundreds of members near you.",
    "Thousands choose us every season.",
    "500 members nearby made the switch.",
    "Join 2,000+ happy customers.",
    "Thousands of families boat with us.",
    "Dozens of local homeowners booked this month.",
  ]) {
    assert.ok(
      rules(validateVariation(v({ primary_text: text }))).includes("invented_social_proof"),
      `missed: ${text}`,
    );
  }
});

test("a review count points at a page anyone can open, so it stands", () => {
  for (const text of [
    "4.7 from 157 Google reviews.",
    "157 reviews, and they keep landing on the same three things.",
    "Rated 4.7 by 157 boaters on Google.",
  ]) {
    assert.ok(
      !rules(validateVariation(v({ primary_text: text }))).includes("invented_social_proof"),
      `wrongly flagged: ${text}`,
    );
  }
});

test("counting things is not counting people", () => {
  for (const text of [
    "300 dry stack spaces and 60 wet slips.",
    "600 feet of floating dock, minutes from the Gulf.",
    "Four marinas, one membership across all of them.",
  ]) {
    assert.deepEqual(rules(validateVariation(v({ primary_text: text }))), []);
  }
});

test("a boat club may not name a membership number, true or not", () => {
  const strict = validateBoatClubVariation(v({ primary_text: "Over 400 members boat with us." }));
  assert.ok(rules(strict).includes("membership_count"));

  // The same copy is only the generic claims problem for anyone else.
  const generic = validateVariation(v({ primary_text: "Over 400 members boat with us." }));
  assert.ok(!rules(generic).includes("membership_count"));
});

test("a marina citing its Google rating is not a boat club membership claim", () => {
  const w = validateBoatClubVariation(v({ primary_text: "4.7 from 157 Google reviews." }));
  assert.deepEqual(rules(w), []);
});

test("a rating written as a symbol counts the same as the word", () => {
  // "4.7 stars from 157 boaters" and "4.7\u2605 from 157 boaters" are one
  // sentence in two typographies; only one of them used to pass.
  for (const text of [
    "Bay Pines Marina, St. Pete. 4.7\u2605 from 157 boaters. See what's open.",
    "4.7 stars from 157 boaters.",
    "Rated 4.7 out of 5 by 157 boaters.",
    "4.7/5 from 157 boaters.",
  ]) {
    assert.ok(
      !rules(validateVariation(v({ primary_text: text }))).includes("invented_social_proof"),
      `wrongly flagged: ${text}`,
    );
  }
});

test("a symbol elsewhere in the ad does not excuse an invented count", () => {
  // The exemption is per sentence, so a rating in one line cannot launder a
  // membership claim in another.
  const text = "4.7\u2605 from 157 Google reviews.\n\nHundreds of members near you.";
  assert.ok(rules(validateVariation(v({ primary_text: text }))).includes("invented_social_proof"));
});

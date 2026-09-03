import assert from "node:assert/strict";
import { test } from "node:test";

import { appendUrlTags, buildAdName, buildUrlTags, slugify } from "./utm.ts";

test("slugify normalizes and truncates", () => {
  assert.equal(slugify("Carefree Boat Club - South Florida"), "carefree-boat-club-south-florida");
  assert.equal(slugify("All The Fun. None Of The Work."), "all-the-fun-none-of-the-work");
  assert.equal(slugify("a".repeat(60)).length, 40);
  // Truncation must not leave a trailing hyphen.
  assert.ok(!slugify("word ".repeat(20)).endsWith("-"));
});

test("buildUrlTags emits the four expected params", () => {
  const tags = new URLSearchParams(buildUrlTags("Test Club", "Your Boat Is Waiting"));
  assert.equal(tags.get("utm_source"), "facebook");
  assert.equal(tags.get("utm_medium"), "paid_social");
  assert.equal(tags.get("utm_campaign"), "test-club");
  assert.equal(tags.get("utm_content"), "your-boat-is-waiting");
});

test("appendUrlTags respects an existing query string", () => {
  assert.equal(appendUrlTags("https://x.com/lp", "a=1"), "https://x.com/lp?a=1");
  assert.equal(appendUrlTags("https://x.com/lp?b=2", "a=1"), "https://x.com/lp?b=2&a=1");
  assert.equal(appendUrlTags("https://x.com/lp", ""), "https://x.com/lp");
});

test("ad name uses the client timezone, not UTC", () => {
  // 01:30 UTC on the 4th is still the 3rd in New York. The old build stamped
  // this ad with the 4th.
  const lateEvening = new Date("2026-06-04T01:30:00Z");
  assert.match(
    buildAdName("Club", "Headline", "America/New_York", lateEvening),
    /2026-06-03$/,
  );
  assert.match(buildAdName("Club", "Headline", "UTC", lateEvening), /2026-06-04$/);
});

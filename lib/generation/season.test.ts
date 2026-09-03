import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPromoSection,
  buildSeasonalSection,
  monthInTimeZone,
} from "./season.ts";

const NY = "America/New_York";

/**
 * These assert the non-obvious copy rules in docs/SPEC.md §9. They are here to
 * fail loudly if someone "tidies" the prompt text later, because a regression
 * in these is invisible until a client's ads read wrong.
 */

test("year_round bans every seasonal urgency phrase, in any month", () => {
  // Peak-summer date. Year-round must still override the month entirely.
  const july = new Date("2026-07-15T12:00:00Z");
  const out = buildSeasonalSection("year_round", july, NY);

  assert.match(out, /YEAR-ROUND BOATING MARKET/);
  assert.match(out, /there is no off-season/);
  // Must not fall through to the peak-season branch.
  assert.doesNotMatch(out, /PEAK BOATING SEASON/);
  // The banned list itself must survive.
  for (const banned of ["this summer", "pre-season", "spring ramp", "lock in before summer"]) {
    assert.ok(out.includes(banned), `year_round must name "${banned}" as banned`);
  }
});

test("month name is never permitted, in every branch", () => {
  const dates = [
    new Date("2026-01-15T12:00:00Z"), // pre-season
    new Date("2026-03-15T12:00:00Z"), // spring ramp
    new Date("2026-06-15T12:00:00Z"), // peak
    new Date("2026-09-15T12:00:00Z"), // late
  ];
  for (const d of dates) {
    const out = buildSeasonalSection("seasonal", d, NY);
    assert.match(out, /NEVER name a specific month/, `missing month ban for ${d.toISOString()}`);
  }
  assert.match(buildSeasonalSection("year_round", dates[0]!, NY), /NEVER name a specific month/);
});

test("the month ban names the current month so the model can avoid it", () => {
  const june = new Date("2026-06-15T12:00:00Z");
  assert.match(buildSeasonalSection("seasonal", june, NY), /no "June"/);
});

test("seasonal branches map to the documented month buckets", () => {
  const cases: Array<[string, RegExp]> = [
    ["2026-05-15T12:00:00Z", /PEAK BOATING SEASON/],   // month 4
    ["2026-08-15T12:00:00Z", /PEAK BOATING SEASON/],   // month 7
    ["2026-09-15T12:00:00Z", /LATE BOATING SEASON/],   // month 8
    ["2026-10-15T12:00:00Z", /LATE BOATING SEASON/],   // month 9
    ["2026-11-15T12:00:00Z", /PRE-SEASON/],            // month 10
    ["2026-02-15T12:00:00Z", /PRE-SEASON/],            // month 1
    ["2026-03-15T12:00:00Z", /SPRING RAMP-UP/],        // month 2
    ["2026-04-15T12:00:00Z", /SPRING RAMP-UP/],        // month 3
  ];
  for (const [iso, expected] of cases) {
    assert.match(
      buildSeasonalSection("seasonal", new Date(iso), NY),
      expected,
      `wrong branch for ${iso}`,
    );
  }
});

test("peak season frames the cost of waiting as memories, never dollars", () => {
  const out = buildSeasonalSection("seasonal", new Date("2026-06-15T12:00:00Z"), NY);
  assert.match(out, /never as dollars/);
});

test("month bucket honors the client timezone, not the server", () => {
  // 01:00 UTC on 1 May is still 30 April in New York — spring ramp, not peak.
  const boundary = new Date("2026-05-01T01:00:00Z");
  assert.equal(monthInTimeZone(boundary, "UTC"), 4);          // May
  assert.equal(monthInTimeZone(boundary, NY), 3);             // April
  assert.match(buildSeasonalSection("seasonal", boundary, NY), /SPRING RAMP-UP/);
  assert.match(buildSeasonalSection("seasonal", boundary, "UTC"), /PEAK BOATING SEASON/);
});

test("promo section is omitted entirely when there is no promotion", () => {
  assert.equal(buildPromoSection(null), "");
  assert.equal(buildPromoSection(undefined), "");
  assert.equal(buildPromoSection(""), "");
});

test("promo section carries the 30% instruction and the do-not-paste rule", () => {
  const out = buildPromoSection("$500 off initiation this month");
  assert.match(out, /approximately 30%/);
  assert.match(out, /do not just paste it in mechanically/);
  assert.ok(out.includes("$500 off initiation this month"));
});

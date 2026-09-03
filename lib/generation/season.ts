/**
 * Seasonal urgency context for boat-club ad copy.
 *
 * Ported verbatim from the Lovable build. These rules were arrived at over
 * many iterations and are not inferable from anything else in the codebase —
 * see docs/SPEC.md §9 rules 4 and 5. Changing the wording changes the output,
 * so treat edits here as a product decision, not a refactor.
 */

export type SeasonType = "seasonal" | "year_round";

/**
 * Ads outlive the month they were written in, so a named month reads as stale
 * to anyone who sees the ad in July that was written in June.
 */
function neverNameMonth(monthName: string): string {
  return `NEVER name a specific month (no "${monthName}", "July", "August", "this month", etc.) — copy may run into the next month and go stale. Use "this weekend", "right now", "this summer", or "the season" instead.`;
}

/**
 * The month bucket is derived in the *client's* timezone, not the server's.
 * The old build used the edge function's UTC clock, so a client in Hawaii
 * could get next month's seasonal framing.
 */
export function monthInTimeZone(date: Date, timeZone: string): number {
  const month = new Intl.DateTimeFormat("en-US", { timeZone, month: "numeric" }).format(date);
  return Number(month) - 1; // 0-indexed, matching Date#getMonth
}

export function monthNameInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "long" }).format(date);
}

export function buildSeasonalSection(
  seasonType: SeasonType,
  date: Date,
  timeZone: string,
): string {
  const month = monthInTimeZone(date, timeZone);
  const monthName = monthNameInTimeZone(date, timeZone);
  const NEVER_NAME_MONTH = neverNameMonth(monthName);

  let note: string;

  if (seasonType === "year_round") {
    // Florida, Texas, Arizona, SoCal. There is no off-season, so seasonal
    // urgency framing reads as nonsense to the audience.
    note = `THIS CLUB IS IN A YEAR-ROUND BOATING MARKET. The water is good all 12 months — there is no off-season here.
DO NOT use seasonal urgency framing. Specifically AVOID: "this summer", "summer is happening", "by July it's gone", "before summer slips away", "the season is here", "lock in before summer", "pre-season", "spring ramp", "get ready for next season", "don't watch another summer pass". ${NEVER_NAME_MONTH}
Instead, drive urgency through: lifestyle FOMO ("members are out on the water this weekend"), weekend transformation ("turn this Saturday into something memorable"), simplicity ("stop researching, start cruising"), and the current promotion when applicable.
The angle rotation still applies, but the FOMO and WEEKEND angles should reference *this weekend* / *next weekend* / *right now* — never *this summer* or a calendar season or a specific month.`;
  } else if (month >= 4 && month <= 7) {
    note = `PEAK BOATING SEASON IS HAPPENING RIGHT NOW.
Every ad must feel time-sensitive. The water is warm, the weekends are booking up, and members are already out on the boats.
Lean hard into FOMO and lifestyle urgency. The cost of waiting is missing this summer entirely (frame as missed memories/weekends — never as dollars).
Use phrases like: "this summer", "this weekend", "the season is here", "don't watch another summer pass", "members are already out", "by the time you decide, the season is gone".
${NEVER_NAME_MONTH}
At least 60% of variations should use the fomo or weekend angle. Every ad — regardless of angle — should carry a subtle "the time is now" undertone.
Do NOT use winter, spring-prep, or "get ready for next season" framing. The season is HERE.`;
  } else if (month >= 8 && month <= 9) {
    note = `LATE BOATING SEASON. Lean into "still warm, still on the water" + "lock in before next summer fills up" urgency. ${NEVER_NAME_MONTH}`;
  } else if (month >= 10 || month <= 1) {
    note = `PRE-SEASON. Frame around "lock in your spot before summer demand hits" and "be ready when the weather turns". ${NEVER_NAME_MONTH}`;
  } else {
    note = `SPRING RAMP-UP. Frame around "season is starting", "first warm weekends", and "get on the water before the rush". ${NEVER_NAME_MONTH}`;
  }

  return `\nSEASONAL URGENCY CONTEXT (CRITICAL):\n${note}\n`;
}

/**
 * The promotion is woven into roughly 30% of variations. This is a model
 * instruction, not enforced in code — the real rate varies.
 */
export function buildPromoSection(currentPromotion: string | null | undefined): string {
  if (!currentPromotion) return "";

  return `
CURRENT PROMOTION FOR THIS CLUB:
${currentPromotion}

Important: Include this promotion naturally in approximately 30% of the generated ad variations.
Weave it into the copy as an urgency/value driver — do not just paste it in mechanically.
Example: "Right now, new members save big on entry. Limited time."
Do not include the promotion in every ad — only where it fits naturally as a hook or closing line.
`;
}

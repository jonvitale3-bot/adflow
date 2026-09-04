import type { AdVariation } from "./schema.ts";

/**
 * Post-generation checks against the copy rules in docs/SPEC.md §9.
 *
 * These are WARNINGS, not rejections. The model follows the rules the large
 * majority of the time, and a variation that trips one is still often usable —
 * the operator decides. Silently discarding output would be worse than
 * flagging it.
 *
 * The same checks run over spreadsheet-imported copy, where they matter more:
 * human-written copy is a deliberate choice and must never be blocked.
 */

export interface CopyWarning {
  rule: string;
  detail: string;
}

const BANNED_CTA_TERMS = ["click", "tap", "instant access", "act now"];

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Vague motivational filler. Banned anywhere in the ad, not at a fixed line:
 * copy is written as paragraphs now, so there is no "line 5" to police.
 */
const BANNED_FILLER = [
  "the water is calling",
  "don't watch another weekend pass",
  "stop planning. start boating",
  "summer won't wait",
  "make this weekend count",
  "your weekend is waiting",
  "time to get on the water",
  "adventure awaits",
  "life's better on the water",
];

/**
 * Social proof that cannot be checked.
 *
 * The line is not "numbers are banned", it is whether a reader could verify
 * the claim. A count of people is a number only the advertiser knows, and an
 * invented one is a liability in paid advertising. A rating or a review count
 * points at a public page anyone can open, and this client's own designed
 * creative carries "4.7 from 157 Google reviews" on the image, so copy that
 * says the same thing is not the problem.
 *
 * Written in parts because the failure of the rule this replaces was that it
 * only matched a digit sitting directly against a noun: it flagged "157
 * reviews" while allowing "hundreds of members", which the brand rules ban by
 * name.
 */
const QUANTITY = String.raw`(?:\d[\d,]*\+?|hundreds|thousands|millions|dozens|scores|countless)`;
const PEOPLE = String.raw`(?:members?|clients?|customers?|families|boaters?|patients?|homeowners?|subscribers?|students?|people)`;
const CHOOSING = String.raw`(?:choose|chose|choosing|joins?|joined|joining|trusts?|trusted|switch(?:ed)?|signed up)`;

// "500 members", "hundreds of members", "2,000+ happy customers".
const PEOPLE_CLAIM = new RegExp(String.raw`\b${QUANTITY}\s+(?:of\s+)?(?:\w+\s+){0,2}${PEOPLE}\b`, "i");
// "thousands choose us", "hundreds have already joined".
const CHOOSING_CLAIM = new RegExp(String.raw`\b${QUANTITY}\s+(?:\w+\s+){0,2}${CHOOSING}\b`, "i");

/**
 * What makes a count checkable is that it says where to check.
 *
 * "157 boaters" is a claim; "157 boaters on Google" is a citation. So the test
 * runs a sentence at a time, and a sentence that names its source keeps its
 * number.
 */
const SOURCED =
  // A named platform, or the language of a review.
  /\b(google|yelp|facebook|trustpilot|bbb|angi|tripadvisor|reviews?|reviewers?|rated|ratings?|stars?)\b/i;

/**
 * A rating written as a symbol rather than a word.
 *
 * "4.7 stars from 157 boaters" and "4.7\u2605 from 157 boaters" are the same
 * sentence, and the second is the form that ends up on the creative. Reading
 * only the word made the rule depend on typography.
 */
const RATING_MARK = /\d(?:\.\d)?\s*(?:[\u2605\u2606\u2b50\u272a\u272d]|\/\s*5\b|out of 5\b)/i;

function claimsUnverifiableProof(text: string): boolean {
  return text
    .split(/(?<=[.!?\n])\s+/)
    .some((sentence) => {
      if (SOURCED.test(sentence) || RATING_MARK.test(sentence)) return false;
      return PEOPLE_CLAIM.test(sentence) || CHOOSING_CLAIM.test(sentence);
    });
}

/**
 * Boat clubs go further: no membership counts at all, true or not. That is a
 * brand decision rather than a claims one, so it lives with the other
 * boat-club rules instead of applying to every client.
 */
const CLUB_COUNT = new RegExp(
  String.raw`\b${QUANTITY}\s+(?:\w+\s+){0,2}(?:members?|memberships?)\b`,
  "i",
);

const COST_COMPARISON = [
  "cheaper than owning",
  "fraction of the cost",
  "vs. ownership",
  "than ownership",
  "save thousands",
  "3x more",
];

/**
 * Only the text is checked, so the parameter is only the text: callers include
 * the review grid, which holds saved rows rather than freshly parsed output.
 */
type Checkable = Pick<AdVariation, "headline" | "primary_text">;

export function validateVariation(v: Checkable): CopyWarning[] {
  const warnings: CopyWarning[] = [];
  const lines = v.primary_text.split("\n").filter((l) => l.trim().length > 0);
  const lower = v.primary_text.toLowerCase();

  const headlineWords = v.headline.trim().split(/\s+/).length;
  if (headlineWords < 4 || headlineWords > 6) {
    warnings.push({
      rule: "headline_length",
      detail: `Headline is ${headlineWords} words; the rule is 4-6.`,
    });
  }

  if (lines.length > 7) {
    warnings.push({
      rule: "primary_text_lines",
      detail: `${lines.length} lines; the maximum is 7.`,
    });
  }

  // Total length, not per-line length.
  //
  // A per-line word cap was the rule here, and it was the thing making every
  // ad read as a stack of clipped fragments: a sentence that carries an idea
  // into the next one is usually longer than ten words. What actually matters
  // is that the ad is short enough to read, which is a whole-text property.
  const totalWords = v.primary_text.trim().split(/\s+/).filter(Boolean).length;
  if (totalWords > 90) {
    warnings.push({
      rule: "primary_text_length",
      detail: `${totalWords} words; keep it under 90 so it is not all behind "... more".`,
    });
  }

  // The CTA is the last non-empty line.
  const cta = lines.at(-1)?.toLowerCase() ?? "";
  for (const term of BANNED_CTA_TERMS) {
    if (cta.includes(term)) {
      warnings.push({ rule: "cta_banned_term", detail: `CTA contains "${term}".` });
    }
  }
  // "learn more" is banned as a verb phrase in the CTA specifically.
  if (/\b(hit|click|tap)\s+learn more\b/.test(cta) || /\blearn more\b/.test(cta)) {
    warnings.push({ rule: "cta_banned_term", detail: 'CTA references "Learn More".' });
  }

  for (const month of MONTHS) {
    if (new RegExp(`\\b${month}\\b`).test(lower)) {
      warnings.push({
        rule: "month_named",
        detail: `Names "${month}" — ads outlive the month they were written in.`,
      });
    }
  }

  if (claimsUnverifiableProof(v.primary_text)) {
    warnings.push({
      rule: "invented_social_proof",
      detail:
        "Claims a number of people (\"hundreds of members\", \"2,000+ customers\"). Nobody can check it, so keep social proof qualitative.",
    });
  }

  for (const phrase of BANNED_FILLER) {
    if (lower.includes(phrase)) {
      warnings.push({
        rule: "platitude",
        detail: `Motivational filler ("${phrase}"); the ad needs something concrete instead.`,
      });
    }
  }

  if (v.primary_text.includes("!")) {
    warnings.push({ rule: "exclamation", detail: "Contains an exclamation mark." });
  }

  // A house rule, and one the model will break given half a chance: dashes are
  // its favourite way to join two thoughts. The prompt bans them and contains
  // none itself; this catches what still slips through.
  for (const [char, name] of [
    ["\u2014", "em dash"],
    ["\u2013", "en dash"],
  ] as const) {
    if (v.primary_text.includes(char) || v.headline.includes(char)) {
      warnings.push({ rule: "dash", detail: `Contains an ${name} (${char}); rewrite it.` });
    }
  }

  return warnings;
}

/** Boat-club only: cost-vs-ownership comparison is banned outright. */
export function validateBoatClubVariation(v: Checkable): CopyWarning[] {
  const warnings = validateVariation(v);
  const lower = v.primary_text.toLowerCase();

  for (const phrase of COST_COMPARISON) {
    if (lower.includes(phrase)) {
      warnings.push({
        rule: "cost_comparison",
        detail: `Compares cost to ownership ("${phrase}"); value is framed as access and simplicity.`,
      });
    }
  }

  if (CLUB_COUNT.test(lower)) {
    warnings.push({
      rule: "membership_count",
      detail:
        "Names a membership number. Clubs vary too much location to location for one to mean anything; keep social proof qualitative.",
    });
  }

  return warnings;
}

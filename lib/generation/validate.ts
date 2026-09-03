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

/** Vague motivational filler explicitly banned from line 5. */
const BANNED_LINE_5 = [
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

const COST_COMPARISON = [
  "cheaper than owning",
  "fraction of the cost",
  "vs. ownership",
  "than ownership",
  "save thousands",
  "3x more",
];

export function validateVariation(v: AdVariation): CopyWarning[] {
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

  for (const [i, line] of lines.entries()) {
    const words = line.trim().split(/\s+/).length;
    if (words > 10) {
      warnings.push({
        rule: "line_length",
        detail: `Line ${i + 1} is ${words} words; the maximum is 10.`,
      });
    }
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

  if (/\b\d[\d,]*\+?\s*(members|clients|customers|reviews|families)\b/.test(lower)) {
    warnings.push({
      rule: "numeric_social_proof",
      detail: "Uses a numeric social-proof claim; qualitative only.",
    });
  }

  const lineFive = lines[4]?.toLowerCase() ?? "";
  for (const phrase of BANNED_LINE_5) {
    if (lineFive.includes(phrase)) {
      warnings.push({
        rule: "line_5_platitude",
        detail: `Line 5 is motivational filler ("${phrase}"); it must be concrete.`,
      });
    }
  }

  if (v.primary_text.includes("!")) {
    warnings.push({ rule: "exclamation", detail: "Contains an exclamation mark." });
  }

  return warnings;
}

/** Boat-club only: cost-vs-ownership comparison is banned outright. */
export function validateBoatClubVariation(v: AdVariation): CopyWarning[] {
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

  return warnings;
}

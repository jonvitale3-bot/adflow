/**
 * Guard against a fabricated offer.
 *
 * Rule 8 in docs/SPEC.md: the original autofill once produced a "20% off
 * first-time renter discount" that did not exist. In paid advertising for a
 * real client that is a liability, so a specific offer the model invented must
 * not survive.
 *
 * But the same specificity is exactly what a REAL offer looks like. Once
 * Auto-fill reads the client's own landing page, "$100 off a water test" is
 * most likely quoted from the page rather than imagined — and blanking it
 * throws away the most useful thing on there.
 *
 * So the rule depends on the source:
 *   read from a page   → keep it, flag it for a human to confirm
 *   inferred from name → strip it, there is nothing it could have come from
 */

const OFFER_SIGNALS =
  /(\$\s?\d|\d+\s?%|\bpercent\s+off\b|\bfree month\b|\bfirst month free\b|\bends (soon|friday|monday|this|next)\b|\blimited time\b|\bthis week only\b|\bexpires\b|\bsave \$?\d)/i;

export function looksLikeSpecificOffer(text: string): boolean {
  return OFFER_SIGNALS.test(text);
}

export type OfferVerdict = "clean" | "stripped" | "needs_confirming";

export function guardOffer<T extends { offer_description: string }>(
  values: T,
  opts: { sourcedFromPage: boolean },
): { values: T; verdict: OfferVerdict } {
  if (!looksLikeSpecificOffer(values.offer_description)) {
    return { values, verdict: "clean" };
  }

  // Quoted from the client's own page — keep it, but say so, because a
  // misread offer in a live ad is still expensive.
  if (opts.sourcedFromPage) {
    return { values, verdict: "needs_confirming" };
  }

  return { values: { ...values, offer_description: "" }, verdict: "stripped" };
}

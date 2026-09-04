/**
 * Backstop against a fabricated offer.
 *
 * Rule 8 in docs/SPEC.md: the original autofill once produced a "20% off
 * first-time renter discount" that did not exist. In paid advertising for a
 * real client that is a liability, not a cosmetic bug — so the prompt forbids
 * it AND this strips it if the prompt is not followed.
 */

const OFFER_SIGNALS =
  /(\$\s?\d|\d+\s?%|\bpercent\s+off\b|\bfree month\b|\bfirst month free\b|\bends (soon|friday|monday|this|next)\b|\blimited time\b|\bthis week only\b|\bexpires\b|\bsave \$?\d)/i;

export function looksLikeInventedOffer(text: string): boolean {
  return OFFER_SIGNALS.test(text);
}

export function stripInventedOffer<T extends { offer_description: string }>(
  values: T,
): { values: T; stripped: boolean } {
  if (!looksLikeInventedOffer(values.offer_description)) {
    return { values, stripped: false };
  }
  return { values: { ...values, offer_description: "" }, stripped: true };
}

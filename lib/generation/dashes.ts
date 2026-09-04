/**
 * Getting dashes out of copy.
 *
 * Substituting the character mechanically is the obvious approach and the
 * wrong one: an em dash usually joins two clauses, and swapping in a comma
 * turns "the run out is quiet, mangroves either side, flat water, right up
 * until you turn" into a pile-up. The sentence needs rewriting, not patching,
 * which is why the real pass is a model call.
 *
 * This is the floor under that call. It guarantees the character is gone even
 * when the rewrite fails or is unavailable, and it is deliberately dull: a
 * comma is the substitution that is grammatical most often and surprising
 * least often.
 */

const DASHES = /[–—]/;

export function hasDash(text: string): boolean {
  return DASHES.test(text);
}

/**
 * Replaces every dash with a comma, then tidies up after itself.
 *
 * A dash frequently sits next to punctuation that already does the job, so
 * substituting blind leaves ", ," and ",." behind.
 */
export function stripDashes(text: string): string {
  return (
    text
      // A dash against a line break is decoration, not punctuation. Taken out
      // rather than replaced, and the break itself is left alone: line breaks
      // are the paragraph structure of an ad.
      .replace(/[ \t]*[–—][ \t]*(?=\n)/g, "")
      .replace(/(?<=\n)[ \t]*[–—][ \t]*/g, "")
      // Everything else joins two parts of a sentence, so it becomes a comma.
      .replace(/[ \t]*[–—][ \t]*/g, ", ")
      // A comma landing against punctuation that already separates.
      .replace(/,\s*([,;:.!?])/g, "$1")
      .replace(/([;:])\s*,/g, "$1")
      // "x, , y", from a pair of dashes with nothing between them.
      .replace(/,[ \t]+,/g, ",")
      // A dash opening or closing a line leaves a stray comma behind.
      .replace(/^[ \t]*,[ \t]*/gm, "")
      .replace(/,[ \t]*$/gm, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+\n/g, "\n")
  );
}

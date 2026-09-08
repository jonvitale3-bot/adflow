import { stripDashes } from "./dashes.ts";

export interface BrandVoiceFields {
  brand_voice: string;
  key_phrases: string;
  never_say: string;
}

/**
 * The mechanical floor under the model's output.
 *
 * Every field here is spliced into the copy prompt, and key_phrases are
 * quoted for the writer to reuse, so a dash that survives here is a dash the
 * ads inherit. Stripped the same way generated copy is.
 */
export function normalizeBrandVoice<T extends BrandVoiceFields>(voice: T): T {
  const lines = (text: string) =>
    stripDashes(text)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");

  return {
    ...voice,
    brand_voice: stripDashes(voice.brand_voice).trim(),
    key_phrases: lines(voice.key_phrases),
    never_say: lines(voice.never_say),
  };
}

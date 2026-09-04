import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { requireEnv } from "@/lib/env";

import { hasDash, stripDashes } from "./dashes.ts";

/**
 * Taking dashes out of copy that already exists.
 *
 * The mechanical substitution in ./dashes.ts always works and is sometimes
 * clumsy, because an em dash normally joins two clauses and a comma in its
 * place can leave a pile-up. Rewriting the sentence is the actual fix, and it
 * is a judgement call, so it goes to the model.
 *
 * What comes back is checked rather than trusted: the whole point is a
 * guarantee, so anything still carrying a dash falls through to the
 * substitution.
 */

const MODEL = "claude-opus-5";

const SYSTEM = `You are editing ad copy that is already approved. One thing is wrong with it: it uses em dashes or en dashes, and this advertiser does not use them.

Rewrite each ad so no dash remains, changing as little else as possible.

- Keep every claim, number, offer, place name and call to action exactly as it is. You are not writing new copy and you are not improving it.
- Where a dash joined two clauses, decide what the sentence actually needed: a comma, a colon, a full stop, or a small reordering. Pick whichever reads best. Do not simply drop a comma in every time.
- Keep the paragraph breaks. A blank line in the input is a blank line in the output.
- Keep the emoji, and keep it where it is.
- Do not add a dash anywhere, including in the headline.
- If an ad has no dash in it, return it byte for byte unchanged.

Return the ads in the order given.`;

const RewriteSchema = z.object({
  ads: z.array(
    z.object({
      index: z.number(),
      headline: z.string(),
      primary_text: z.string(),
    }),
  ),
});

export interface Rewritable {
  headline: string;
  primary_text: string;
}

export interface Rewritten extends Rewritable {
  /** True when the model declined or failed and the substitution was used. */
  fellBack: boolean;
}

/** Belt and braces: the substitution, applied to whatever is still carrying one. */
function enforce(ad: Rewritable): Rewritten {
  const dirty = hasDash(ad.headline) || hasDash(ad.primary_text);
  return {
    headline: dirty ? stripDashes(ad.headline) : ad.headline,
    primary_text: dirty ? stripDashes(ad.primary_text) : ad.primary_text,
    fellBack: dirty,
  };
}

export async function rewriteWithoutDashes(ads: Rewritable[]): Promise<Rewritten[]> {
  if (ads.length === 0) return [];

  let parsed: z.infer<typeof RewriteSchema> | null = null;
  try {
    const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: ads
            .map(
              (ad, i) =>
                `--- ad ${i} ---\nHEADLINE: ${ad.headline}\nPRIMARY TEXT:\n${ad.primary_text}`,
            )
            .join("\n\n"),
        },
      ],
      output_config: { format: zodOutputFormat(RewriteSchema) },
    });

    // A safety decline arrives as HTTP 200, so it is checked before reading.
    if (response.stop_reason !== "refusal") parsed = response.parsed_output;
  } catch {
    // Every ad still gets fixed, just bluntly.
  }

  const byIndex = new Map(parsed?.ads.map((a) => [a.index, a]) ?? []);

  return ads.map((original, i) => {
    const rewritten = byIndex.get(i);
    // A rewrite that lost the copy is not a rewrite. Length is a crude guard,
    // but it catches a truncated or hallucinated reply, which is the failure
    // that would quietly ship a half-written ad.
    const plausible =
      rewritten &&
      rewritten.primary_text.length > original.primary_text.length * 0.5 &&
      rewritten.headline.trim().length > 0;

    return enforce(plausible ? rewritten : original);
  });
}

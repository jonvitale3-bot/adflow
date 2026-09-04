import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { requireEnv } from "@/lib/env";

export { stripInventedOffer } from "./offer-guard.ts";

/**
 * Pre-fills client fields from a business name and location.
 *
 * The hard rule here is rule 8 in docs/SPEC.md: NEVER invent an offer. The
 * original once fabricated a "20% off first-time renter discount" that did not
 * exist — in paid advertising for a real client, that is a liability, not a
 * cosmetic bug. The schema and the prompt both enforce it.
 */

export const AutofillSchema = z.object({
  market_name: z
    .string()
    .describe("Short market label, e.g. 'Charlotte, NC' or 'Space Coast'. Empty if unknown."),
  boating_style: z
    .string()
    .describe("Boat clubs only: typical boats and boating for this market. Otherwise empty."),
  environment_style: z
    .string()
    .describe("The physical setting an ad photo should show. Empty if unknown."),
  business_type_description: z
    .string()
    .describe("What this business actually sells. Empty for boat clubs."),
  offer_description: z
    .string()
    .describe(
      "What the ad should drive to, as a generic action. NEVER a specific discount, price, percentage or deadline.",
    ),
  tone_keywords: z.string().describe("Four to six tone words, comma separated."),
});

export type AutofillValues = z.infer<typeof AutofillSchema>;

const MODEL = "claude-opus-5";

const SHARED_RULES = `HARD RULES:
- NEVER invent an offer, discount, dollar amount, percentage, time window, deadline, or promotion. If you do not know of a real one, describe the action generically — "book a consultation", "request a quote", "start a membership enquiry" — and leave the specifics for a human to fill in. Inventing an offer that does not exist is a liability in paid advertising.
- NEVER invent numeric social proof, review counts, member counts, or years in business.
- Business-name keywords are ground truth. If the name contains "Rental", "Storage", "Slips", "Service", "Repair", "Charter", "Sales", "Insurance", "Realty" or similar, that IS the primary offering. Commit to it — do not hedge with "and potentially also...".
- Return an empty string for any field you cannot fill honestly. An empty field is correct; a plausible guess is not.`;

const BOAT_CLUB_PROMPT = `You are helping set up a Meta ads account for a membership boat club location.

Given the club's name and location, infer the local boating context: the market label, the kind of boating and boats typical there, and the physical environment an ad photo should depict.

Leave business_type_description empty — the category is already known.

${SHARED_RULES}`;

const GENERIC_PROMPT = `You are helping set up a Meta ads account for a local business.

Given the business name and location, infer what it sells, the market it serves, the physical environment an ad photo should depict, what its ads should drive to, and the tone its copy should carry.

Leave boating_style empty unless this is genuinely a boating business.

${SHARED_RULES}`;

export async function autofillClientFields(input: {
  name: string;
  locationDescription?: string | null;
  industry: string;
  marineBusinessType?: string | null;
}): Promise<AutofillValues> {
  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  const isBoatClub = input.industry === "boat_club";
  const context = [
    `Business name: ${input.name}`,
    input.locationDescription ? `Location: ${input.locationDescription}` : null,
    `Industry: ${input.industry.replace(/_/g, " ")}`,
    input.marineBusinessType
      ? `Marina business type: ${input.marineBusinessType.replace(/_/g, " ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    system: isBoatClub ? BOAT_CLUB_PROMPT : GENERIC_PROMPT,
    messages: [{ role: "user", content: context }],
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(AutofillSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request.");
  }
  if (!response.parsed_output) {
    throw new Error("Autofill returned an unexpected shape.");
  }

  return response.parsed_output;
}

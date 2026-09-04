import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { requireEnv } from "@/lib/env";

import { htmlToText } from "./discover-pages.ts";
import { extractPixelId } from "./extract.ts";

export { stripInventedOffer } from "./offer-guard.ts";

/**
 * Prefills client fields.
 *
 * When a landing page URL is available the page is READ, and the answers come
 * from the client's own copy rather than from what the model believes about a
 * business with that name. That is a large quality difference: a real page
 * states the actual services, the actual offer and the actual location.
 *
 * The hard rule remains docs/SPEC.md rule 8: never invent an offer. Reading a
 * stated offer off the client's own page is not inventing one; producing a
 * discount that appears nowhere is, and that is what the guard catches.
 */

export const AutofillSchema = z.object({
  market_name: z
    .string()
    .describe("Short market label, e.g. 'Charlotte, NC' or 'Space Coast'. Empty if unknown."),
  location_description: z
    .string()
    .describe("Where this location is and what surrounds it — city, state, waterway, landmarks."),
  boating_style: z
    .string()
    .describe("Boat clubs and marinas only: typical boats and boating here. Otherwise empty."),
  environment_style: z
    .string()
    .describe("The physical setting an ad photo should show. Empty if unknown."),
  business_type_description: z
    .string()
    .describe("What this business actually sells. Empty for boat clubs."),
  offer_description: z
    .string()
    .describe(
      "What the ad drives to. If the page states a real offer, describe it. Otherwise a generic action — NEVER an invented discount, price, percentage or deadline.",
    ),
  tone_keywords: z.string().describe("Four to six tone words, comma separated."),
});

export type AutofillValues = z.infer<typeof AutofillSchema>;

export interface AutofillResult {
  values: AutofillValues;
  pixelId: string | null;
  readUrl: string | null;
  sourcedFromPage: boolean;
}

const MODEL = "claude-opus-5";
const UA = "Mozilla/5.0 (compatible; AdFlowBot/1.0)";

const SHARED_RULES = `HARD RULES:
- NEVER invent an offer, discount, dollar amount, percentage, time window, deadline, or promotion. If the page states one, describe it accurately. If it does not, describe the action generically — "book a tour", "request a quote", "start a membership enquiry" — and leave the specifics for a human. Inventing an offer that does not exist is a liability in paid advertising.
- NEVER invent numeric social proof, review counts, member counts, or years in business.
- Business-name keywords are ground truth. If the name contains "Rental", "Storage", "Slips", "Service", "Repair", "Charter", "Sales", "Insurance", "Realty" or similar, that IS the primary offering. Commit to it — do not hedge.
- Return an empty string for any field you cannot fill honestly. An empty field is correct; a plausible guess is not.`;

const FROM_PAGE = `You are reading a business's own landing page to set up its Meta ads account.

Everything you write must come from the page in front of you. Where the page is silent, leave the field empty rather than filling it from general knowledge about businesses of this type.

${SHARED_RULES}`;

const FROM_NAME = `You are setting up a Meta ads account for a local business, working only from its name and location — there is no website to read.

Infer what it sells, the market it serves, and the physical environment an ad photo should depict. Be conservative: this is inference, not observation.

${SHARED_RULES}`;

async function fetchPage(url: string, timeoutMs = 12_000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function autofillClientFields(input: {
  name: string;
  locationDescription?: string | null;
  industry: string;
  marineBusinessTypes?: string[] | null;
  landingPageUrl?: string | null;
}): Promise<AutofillResult> {
  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  // Read the landing page when there is one. It states the real services and
  // the real offer, and it carries the pixel.
  let html: string | null = null;
  let readUrl: string | null = null;

  if (input.landingPageUrl?.trim()) {
    const raw = input.landingPageUrl.trim();
    readUrl = raw.startsWith("http") ? raw : `https://${raw}`;
    html = await fetchPage(readUrl);
    if (!html) readUrl = null;
  }

  const pixelId = html ? extractPixelId(html) : null;

  const context = [
    `Business name: ${input.name}`,
    input.locationDescription ? `Location: ${input.locationDescription}` : null,
    `Industry: ${input.industry.replace(/_/g, " ")}`,
    input.marineBusinessTypes?.length
      ? `Services offered: ${input.marineBusinessTypes.map((s) => s.replace(/_/g, " ")).join(", ")}`
      : null,
    html ? `\n--- Landing page (${readUrl}) ---\n${htmlToText(html, 15000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 2048,
    system: html ? FROM_PAGE : FROM_NAME,
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

  return {
    values: response.parsed_output,
    pixelId,
    readUrl,
    sourcedFromPage: Boolean(html),
  };
}

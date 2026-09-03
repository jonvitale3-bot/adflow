import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { requireEnv } from "@/lib/env";

import { htmlToText, selectPagesToRead } from "./discover-pages.ts";

export const BrandVoiceSchema = z.object({
  brand_voice: z
    .string()
    .describe("How this brand sounds. Tone, register, what it emphasises. A short paragraph."),
  key_phrases: z
    .string()
    .describe("Distinctive phrases the brand actually uses, verbatim, newline separated."),
  never_say: z
    .string()
    .describe("Words, claims, or framings this brand avoids or must avoid, newline separated."),
});

export type BrandVoice = z.infer<typeof BrandVoiceSchema>;

const MODEL = "claude-opus-5";
const UA = "Mozilla/5.0 (compatible; AdFlowBot/1.0)";

/**
 * Compliance guidance the model must fold into never_say for regulated
 * verticals. Meta restricts targeting for these categories, and the copy has
 * to avoid claims the vertical cannot make regardless of platform rules.
 */
const CATEGORY_GUIDANCE: Record<string, string> = {
  credit: `This advertiser is in a Meta CREDIT special ad category (finance, lending, insurance, banking).
never_say MUST include: guaranteed approval, guaranteed rates or returns, specific unqualified APR or savings figures, "no credit check", urgency implying a credit decision, and any claim implying a personalised financial outcome.`,
  housing: `This advertiser is in a Meta HOUSING special ad category (real estate, mortgages, rentals).
never_say MUST include: any language describing the intended audience or who a property suits, references to family status, and any wording that could read as steering or exclusion under fair-housing rules.`,
  employment: `This advertiser is in a Meta EMPLOYMENT special ad category.
never_say MUST include: any language describing who should apply, and any framing that could exclude a protected class.`,
};

async function fetchPage(url: string, timeoutMs = 10_000): Promise<string | null> {
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
    // A single unreachable page must not fail the whole scrape.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function scrapeBrandVoice(
  websiteUrl: string,
  opts: { specialAdCategory?: string; industry?: string } = {},
): Promise<BrandVoice> {
  const base = new URL(websiteUrl);

  const homeHtml = await fetchPage(base.toString());
  if (!homeHtml) {
    throw new Error(`Could not read ${base.hostname}. Check the URL is correct and reachable.`);
  }

  // Pages are chosen from the site's own links rather than assumed paths.
  const pages = selectPagesToRead(homeHtml, base.toString(), 4);
  const fetched = await Promise.all(
    pages.map(async (url, i) => ({
      url,
      html: i === 0 ? homeHtml : await fetchPage(url),
    })),
  );

  const corpus = fetched
    .filter((p): p is { url: string; html: string } => Boolean(p.html))
    .map((p) => `--- ${p.url} ---\n${htmlToText(p.html)}`)
    .join("\n\n");

  if (corpus.trim().length < 200) {
    throw new Error(
      `${base.hostname} returned almost no readable text. It may be a single-page app that renders client-side.`,
    );
  }

  const guidance = opts.specialAdCategory ? CATEGORY_GUIDANCE[opts.specialAdCategory] : undefined;

  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4096,
    system: `You infer a brand's advertising voice from its own website copy, for a media buyer who will use it to write Meta ads.

Rules:
- Describe how the brand ACTUALLY sounds, from the copy in front of you. Do not invent an aspirational voice it has not earned.
- key_phrases must be phrases the site genuinely uses. Quote them. Do not paraphrase and do not invent taglines.
- never_say should capture what this brand avoids — claims it does not make, registers it does not use, competitor framing it stays away from.
- NEVER invent an offer, discount, price, percentage, or time window. If the site states one, you may note it; if it does not, say nothing about offers.
- If the copy is thin, say so rather than padding.${guidance ? `\n\n${guidance}` : ""}`,
    messages: [
      {
        role: "user",
        content: `Website: ${base.hostname}${opts.industry ? `\nIndustry: ${opts.industry}` : ""}\n\n${corpus}`,
      },
    ],
    thinking: { type: "adaptive" },
    output_config: { format: zodOutputFormat(BrandVoiceSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to analyse this site.");
  }
  if (!response.parsed_output) {
    throw new Error("Brand voice analysis returned an unexpected shape.");
  }

  return response.parsed_output;
}

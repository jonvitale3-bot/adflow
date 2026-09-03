import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { requireEnv } from "@/lib/env";

import { buildSystemPrompt, buildUserMessage, type CopyPromptInput } from "./prompts.ts";
import { AdVariationsSchema, type AdVariation } from "./schema.ts";
import { validateBoatClubVariation, validateVariation, type CopyWarning } from "./validate.ts";

export interface GeneratedVariation extends AdVariation {
  warnings: CopyWarning[];
}

export interface GenerateCopyResult {
  variations: GeneratedVariation[];
  systemPrompt: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
}

const MODEL = "claude-opus-5";

export class CopyGenerationError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "CopyGenerationError";
  }
}

export async function generateCopy(input: CopyPromptInput): Promise<GenerateCopyResult> {
  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  const systemPrompt = buildSystemPrompt(input);
  const userMessage = buildUserMessage(input);

  let response;
  try {
    response = await client.messages.parse({
      model: MODEL,
      // 50 variations of ~80 words each, plus thinking. Streaming is not used
      // because parse() needs the complete message anyway.
      max_tokens: 16000,
      // The system prompt is long, rule-dense, and identical across every
      // request for a given client — a textbook cache prefix. The volatile
      // part (the count, the ask) lives in the user message, after it.
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMessage }],
      // The prompt is a dense stack of overriding constraints — line counts,
      // word counts, ban lists, angle rotation. Worth thinking about.
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(AdVariationsSchema) },
    });
  } catch (err) {
    throw new CopyGenerationError(
      err instanceof Error ? err.message : "Copy generation request failed",
      err,
    );
  }

  // A safety decline arrives as HTTP 200 with stop_reason "refusal", so it must
  // be checked before reading content.
  if (response.stop_reason === "refusal") {
    throw new CopyGenerationError(
      "The model declined this request. Check the client's brand settings and promotion text for anything that reads as a prohibited claim.",
    );
  }

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new CopyGenerationError("The model returned output that did not match the schema.");
  }

  const validate =
    input.industry === "boat_club" ? validateBoatClubVariation : validateVariation;

  return {
    variations: parsed.variations.map((v) => ({ ...v, warnings: validate(v) })),
    systemPrompt,
    model: MODEL,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    },
  };
}

export { pairWithCreatives } from "./pairing.ts";

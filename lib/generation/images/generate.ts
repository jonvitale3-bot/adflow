import "server-only";

import OpenAI from "openai";

import { requireEnv } from "@/lib/env";

import { buildImagePrompt, type ImagePromptInput } from "./templates.ts";

/**
 * Direct OpenAI image generation, replacing the Lovable AI Gateway — which is
 * platform-specific and disappears with the Lovable project.
 */

const MODEL = "gpt-image-1";
const SIZE = "1024x1024";
const QUALITY = "high";

/** The original capped a batch at 12; a batch of 12 already runs ~150s. */
export const MAX_IMAGES = 12;

export class ImageGenerationError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

export interface GeneratedImage {
  index: number;
  base64: string;
  prompt: string;
  sceneId: string | null;
}

function toFriendlyError(err: unknown): ImageGenerationError {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      return new ImageGenerationError("Rate limited by OpenAI. Try again shortly.", true);
    }
    if (err.status === 401) {
      return new ImageGenerationError("OPENAI_API_KEY is missing or invalid.");
    }
    if (err.status === 400 && /safety|policy|content/i.test(err.message)) {
      // Worth distinguishing: a rejected prompt is a prompt problem, not an
      // outage, and retrying it changes nothing.
      return new ImageGenerationError(
        "OpenAI rejected this prompt on content policy. Check the scene and brand text for anything that reads as a prohibited claim.",
      );
    }
    if (err.status && err.status >= 500) {
      return new ImageGenerationError("OpenAI is having trouble. Try again shortly.", true);
    }
    return new ImageGenerationError(err.message);
  }
  return new ImageGenerationError(
    err instanceof Error ? err.message : "Image generation failed",
  );
}

/** Generates one image and returns it as base64, with the prompt that made it. */
export async function generateImage(
  input: ImagePromptInput & { sceneId?: string | null },
  index: number,
): Promise<GeneratedImage> {
  const client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  const prompt = buildImagePrompt(input);

  try {
    const response = await client.images.generate({
      model: MODEL,
      prompt,
      size: SIZE,
      quality: QUALITY,
      n: 1,
    });

    const base64 = response.data?.[0]?.b64_json;
    if (!base64) {
      throw new ImageGenerationError("OpenAI returned no image data.");
    }

    return { index, base64, prompt, sceneId: input.sceneId ?? null };
  } catch (err) {
    if (err instanceof ImageGenerationError) throw err;
    throw toFriendlyError(err);
  }
}

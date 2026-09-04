import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { requireEnv } from "@/lib/env";

import { SCENE_LABELS } from "@/lib/generation/images/labels";

/**
 * A one-line description of what a creative depicts.
 *
 * This is what lets copy be written to the image it will run with. Generated
 * images already know — their scene says so — and cost nothing to describe.
 * Uploads need looking at, which is one vision call per image, done once and
 * stored.
 *
 * The same look also answers a second question: does this image have copy
 * burned into it? An image carrying a headline or an offer badge must never be
 * auto-cropped for a placement, because the crop takes the corner the badge is
 * in. Asking here costs nothing — the model is already looking at the pixels.
 */

const MODEL = "claude-opus-5";
const MAX_BYTES = 4 * 1024 * 1024;

/** Free: a generated image's scene already describes it. */
export function describeFromScene(scene: string | null, renderedPrompt: string | null): string | null {
  if (!scene) return null;

  // Multi-service marina scenes are namespaced "service:scene".
  const sceneId = scene.includes(":") ? scene.split(":")[1]! : scene;
  const label = SCENE_LABELS[sceneId];

  if (label) return label;

  // Fall back to the scene sentence from the prompt, which is the most
  // concrete description available.
  const match = /SCENE FOCUS FOR THIS IMAGE[^\n]*\n(.+)/.exec(renderedPrompt ?? "");
  return match?.[1]?.trim().slice(0, 300) ?? sceneId.replace(/_/g, " ");
}

const SYSTEM = `You are looking at an image that will run as a Meta ad. Report two things.

1. description — one sentence, under 30 words, for a copywriter who cannot see it. Say what is literally in the frame: the subject, the activity, the setting, the time of day, the mood. Be concrete and specific. Do not evaluate the image, do not suggest copy, do not speculate about the brand. If people are present, describe what they are doing, never their identity or appearance beyond what an ad brief would need.

2. has_baked_text — true if any words, numbers, logo, price, badge, button, review card, or graphic overlay are part of the image itself. A sign, a boat name, a shop front, or a licence plate that happens to be in the photographed scene does NOT count; only chrome laid over the photo by a designer does. When you are unsure, answer true.

Why it matters: an image with designed-in copy cannot be machine-cropped to another aspect ratio without cutting that copy off, so this decides whether the ad platform is allowed to reframe it.`;

const LookSchema = z.object({
  description: z.string(),
  has_baked_text: z.boolean(),
});

export interface ImageLook {
  description: string;
  /** Designed-in copy or chrome, which a placement crop would cut. */
  hasBakedText: boolean;
}

/** Looks at an uploaded image. One call per creative, once. */
export async function describeImage(imageUrl: string): Promise<ImageLook> {
  const res = await fetch(imageUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not fetch the image (${res.status})`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
    throw new Error(`Unsupported image type: ${contentType || "unknown"}`);
  }

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("Image is too large to describe");
  }

  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: contentType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: Buffer.from(bytes).toString("base64"),
            },
          },
          { type: "text", text: "Describe this ad image, and say whether copy is baked into it." },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(LookSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to describe this image.");
  }

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("No description returned");

  return {
    description: parsed.description.trim(),
    hasBakedText: parsed.has_baked_text,
  };
}

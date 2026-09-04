import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { requireEnv } from "@/lib/env";

import { SCENE_LABELS } from "@/lib/generation/images/labels";

/**
 * A one-line description of what a creative depicts.
 *
 * This is what lets copy be written to the image it will run with. Generated
 * images already know — their scene says so — and cost nothing to describe.
 * Uploads need looking at, which is one vision call per image, done once and
 * stored.
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

const SYSTEM = `You describe an advertising photograph in one sentence, for a copywriter who cannot see it.

Say what is literally in the frame — the subject, the activity, the setting, the time of day, the mood. Be concrete and specific.

Do not evaluate the image, do not suggest copy, do not speculate about the brand. If people are present, describe what they are doing, never their identity or appearance beyond what an ad brief would need.

One sentence, under 30 words.`;

/** Looks at an uploaded image. One call per creative, once. */
export async function describeImage(imageUrl: string): Promise<string> {
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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
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
          { type: "text", text: "Describe this ad image in one sentence." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to describe this image.");
  }

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("No description returned");

  return text.text.trim();
}

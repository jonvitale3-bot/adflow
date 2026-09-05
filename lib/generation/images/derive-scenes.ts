import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { requireEnv } from "@/lib/env";

/**
 * Scenes for a client nobody wrote a scene bank for.
 *
 * The hand-tuned banks in ./scenes.ts cover boat clubs and marinas, and they
 * are months of iteration — they stay. Every other client got nothing: an
 * empty scene, the same prompt six times, and six images of one man doing one
 * thing. That is not a tuning problem, it is a missing input.
 *
 * Writing a bank per industry does not scale and would be guesswork anyway;
 * nobody here knows what six good photographs of a water treatment call look
 * like. The client's own description does: softeners, RO membranes, filter
 * changes, water testing, heaters, valves. So the scenes are derived from it.
 */

const MODEL = "claude-opus-5";

const SYSTEM = `You are a photo editor briefing a photographer for a local service business's ad campaign.

Given what the business does, list distinct moments worth photographing on a real job. Each becomes one advertising photograph.

- Every scene must be a DIFFERENT moment: a different task, a different part of the property, a different point in the visit. If two scenes could produce a similar-looking photograph, replace one.
- Ground each in the specific work this business does. Name the actual equipment and the actual task. "A technician working" is useless; "kneeling to swap the sediment cartridge on a whole-house filter, old cartridge on newspaper beside him" is a photograph.
- Vary who and what is in frame across the set: sometimes the worker, sometimes only their hands, sometimes the equipment alone, sometimes a homeowner present, sometimes the van or the exterior.
- Vary the setting within what is plausible for this business: basement, garage, utility room, kitchen sink, outside by the meter, the driveway.
- Keep to what a customer would recognise as ordinary and true. No heroics, no drama, nobody smiling at the camera.
- One or two sentences each, present tense, describing what is in the frame. No camera direction, no lighting, no composition notes.

Return exactly the number of scenes asked for, ordered so that consecutive scenes look as different from each other as possible.`;

const SceneSchema = z.object({
  scenes: z.array(
    z.object({
      /** A short slug, stored so a good scene can be recognised later. */
      id: z.string(),
      text: z.string(),
    }),
  ),
});

export interface DeriveScenesInput {
  clientName: string;
  businessTypeDescription?: string | null;
  marketName?: string | null;
  locationDescription?: string | null;
  toneKeywords?: string | null;
  count: number;
}

export interface DerivedScene {
  id: string;
  text: string;
}

/**
 * Returns scenes, or an empty list if the model cannot be reached.
 *
 * An empty list is the behaviour that existed before this: every image gets
 * the same prompt. Worth falling back to rather than failing a batch someone
 * is waiting on.
 */
export async function deriveScenes(input: DeriveScenesInput): Promise<DerivedScene[]> {
  const business = input.businessTypeDescription?.trim();
  // With nothing to describe, a model call would be inventing the business.
  if (!business) return [];

  const where = input.marketName || input.locationDescription;

  try {
    const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `BUSINESS: ${input.clientName}`,
            where ? `AREA: ${where}` : null,
            `WHAT THEY DO:\n${business}`,
            input.toneKeywords ? `HOW THEY WANT TO COME ACROSS: ${input.toneKeywords}` : null,
            "",
            `Give me exactly ${input.count} scenes.`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      output_config: { format: zodOutputFormat(SceneSchema) },
    });

    if (response.stop_reason === "refusal") return [];
    return response.parsed_output?.scenes ?? [];
  } catch {
    // Same outcome as having no bank, which is where this started.
    return [];
  }
}

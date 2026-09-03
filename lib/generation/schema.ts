import { z } from "zod";

export const ANGLES = [
  "lifestyle",
  "simplicity",
  "local",
  "social_proof",
  "fomo",
  "weekend",
] as const;

/**
 * The shape the model must return. Previously the response was regex-scraped
 * for the first `[...]` block, because the model would wrap its JSON in prose;
 * the old code carried three separate parse-failure branches as a result
 * (docs/SPEC.md §5.1). Structured outputs make the shape a guarantee.
 */
export const AdVariationSchema = z.object({
  headline: z.string().describe("4-6 words, plain English, benefit-driven. No wordplay."),
  primary_text: z
    .string()
    .describe("6 lines max, \\n between lines within a section, \\n\\n between sections."),
  angle: z.enum(ANGLES),
});

export const AdVariationsSchema = z.object({
  variations: z.array(AdVariationSchema),
});

export type AdVariation = z.infer<typeof AdVariationSchema>;

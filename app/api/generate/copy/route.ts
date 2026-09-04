import { NextResponse } from "next/server";
import { z } from "zod";

import { generateCopy } from "@/lib/generation/copy";
import { CopyGenerationError } from "@/lib/generation/copy";
import { createClient } from "@/lib/supabase/server";

// Generating 50 variations with adaptive thinking runs well past the default
// timeout. Confirm the ceiling for the current Vercel plan; see docs/DEPLOY.md.
export const maxDuration = 300;

const RequestSchema = z.object({
  clientName: z.string().min(1),
  locationDescription: z.string().default(""),
  industry: z.string().default("boat_club"),
  seasonType: z.enum(["seasonal", "year_round"]).default("seasonal"),
  currentPromotion: z.string().optional(),
  businessTypeDescription: z.string().optional(),
  offerDescription: z.string().optional(),
  toneKeywords: z.string().optional(),
  brandVoice: z.string().optional(),
  keyPhrases: z.string().optional(),
  neverSay: z.string().optional(),
  adExamples: z.string().optional(),
  count: z.number().int().min(1).max(50).default(10),
  timeZone: z.string().default("America/New_York"),
  pairedImages: z.array(z.string().nullable()).optional(),
});

export async function POST(request: Request) {
  // Middleware already gates this, but a route that reaches an external API on
  // an unauthenticated request is exactly the failure mode being rebuilt away
  // from — so it checks for itself too.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const input = parsed.data;

  try {
    const result = await generateCopy({
      clientName: input.clientName,
      locationDescription: input.locationDescription,
      industry: input.industry,
      seasonType: input.seasonType,
      currentPromotion: input.currentPromotion,
      businessTypeDescription: input.businessTypeDescription,
      offerDescription: input.offerDescription,
      toneKeywords: input.toneKeywords,
      brand: {
        brandVoice: input.brandVoice,
        keyPhrases: input.keyPhrases,
        neverSay: input.neverSay,
        adExamples: input.adExamples,
      },
      count: input.count,
      timeZone: input.timeZone,
      pairedImages: input.pairedImages,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CopyGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("copy generation failed", err);
    return NextResponse.json({ error: "Copy generation failed" }, { status: 500 });
  }
}

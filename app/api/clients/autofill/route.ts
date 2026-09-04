import { NextResponse } from "next/server";
import { z } from "zod";

import { autofillClientFields } from "@/lib/generation/autofill";
import { stripInventedOffer } from "@/lib/generation/offer-guard";
import { createClient } from "@/lib/supabase/server";

// Fetching a landing page and reasoning over it runs past the default.
export const maxDuration = 90;

const BodySchema = z.object({
  name: z.string().trim().min(1),
  locationDescription: z.string().trim().optional(),
  industry: z.string(),
  marineBusinessTypes: z.array(z.string()).optional(),
  landingPageUrl: z.string().trim().optional(),
});

/** Works before a client exists, so it is useful during Add, not only Edit. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A business name is required to auto-fill" }, { status: 400 });
  }

  try {
    const result = await autofillClientFields({
      name: parsed.data.name,
      locationDescription: parsed.data.locationDescription,
      industry: parsed.data.industry,
      marineBusinessTypes: parsed.data.marineBusinessTypes ?? null,
      landingPageUrl: parsed.data.landingPageUrl ?? null,
    });

    const { values, stripped } = stripInventedOffer(result.values);

    const notes: string[] = [];
    if (result.sourcedFromPage) {
      notes.push("Read the landing page.");
    } else if (parsed.data.landingPageUrl) {
      notes.push("Could not read that landing page, so these are inferred from the name.");
    } else {
      notes.push("No landing page set, so these are inferred from the name and location.");
    }
    if (result.pixelId) notes.push("Found the Meta pixel on the page.");
    // Surfaced rather than swallowed, so a recurring problem stays visible.
    if (stripped) notes.push("An invented offer was removed — fill in the real one yourself.");

    return NextResponse.json({
      values: { ...values, meta_pixel_id: result.pixelId ?? "" },
      notice: notes.join(" "),
      sourcedFromPage: result.sourcedFromPage,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auto-fill failed" },
      { status: 502 },
    );
  }
}

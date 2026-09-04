import { NextResponse } from "next/server";
import { z } from "zod";

import { autofillClientFields, stripInventedOffer } from "@/lib/generation/autofill";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const BodySchema = z.object({
  name: z.string().trim().min(1),
  locationDescription: z.string().trim().optional(),
  industry: z.string(),
  marineBusinessType: z.string().optional(),
});

/**
 * Works before a client exists, so the form can prefill during "Add client"
 * rather than only when editing.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A business name is required to auto-fill" },
      { status: 400 },
    );
  }

  try {
    const raw = await autofillClientFields({
      name: parsed.data.name,
      locationDescription: parsed.data.locationDescription,
      industry: parsed.data.industry,
      marineBusinessType: parsed.data.marineBusinessType,
    });

    const { values, stripped } = stripInventedOffer(raw);

    return NextResponse.json({
      values,
      // Surfaced rather than silently swallowed, so a recurring problem is
      // visible instead of invisible.
      warning: stripped
        ? "An invented offer was removed. Fill in the real offer yourself."
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Auto-fill failed" },
      { status: 502 },
    );
  }
}

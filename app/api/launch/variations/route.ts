import { NextResponse } from "next/server";
import { z } from "zod";

import { pairWithCreatives } from "@/lib/generation/pairing";
import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  clientId: z.string().uuid(),
  variations: z
    .array(
      z.object({
        headline: z.string(),
        primary_text: z.string(),
        angle: z.string().optional(),
      }),
    )
    .min(1)
    .max(50),
  creativeIds: z.array(z.string().uuid().nullable()).optional(),
});

/** Persists a generated batch and pairs it with the client's creatives. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { clientId, variations, creativeIds } = parsed.data;

  // Archived creatives are excluded from new pairings but stay attached to
  // variations already made from them.
  const { data: creatives } = await supabase
    .from("creatives")
    .select("id, created_at, description")
    .eq("client_id", clientId)
    .eq("archived", false);

  // Honour the pairing the copy was written for; fall back to round-robin.
  const pairing =
    creativeIds?.length === variations.length
      ? creativeIds
      : pairWithCreatives(variations.length, creatives ?? []);

  const { data, error } = await supabase
    .from("ad_variations")
    .insert(
      variations.map((v, i) => ({
        client_id: clientId,
        headline: v.headline,
        primary_text: v.primary_text,
        angle: v.angle ?? null,
        creative_id: pairing[i],
        source: "ai" as const,
        status: "draft" as const,
      })),
    )
    .select("id, headline, primary_text, angle, status, meta_ad_id, error, creatives(image_url)");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ variations: data }, { status: 201 });
}

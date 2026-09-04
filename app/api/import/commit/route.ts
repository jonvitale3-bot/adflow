import { NextResponse } from "next/server";
import { z } from "zod";

import { matchCreative } from "@/lib/import/parse";
import { pairWithCreatives } from "@/lib/generation/pairing";
import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  clientId: z.string().uuid(),
  rows: z
    .array(
      z.object({
        headline: z.string().min(1),
        primary_text: z.string().min(1),
        image: z.string().optional(),
        angle: z.string().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { clientId, rows } = parsed.data;

  const { data: creatives } = await supabase
    .from("creatives")
    .select("id, label, storage_path, created_at")
    .eq("client_id", clientId)
    .eq("archived", false);

  const pool = creatives ?? [];
  // Rows naming an image get exactly that one; the rest fall back to the same
  // round-robin the generator uses.
  const fallback = pairWithCreatives(rows.length, pool);

  const { data, error } = await supabase
    .from("ad_variations")
    .insert(
      rows.map((row, i) => ({
        client_id: clientId,
        headline: row.headline,
        primary_text: row.primary_text,
        angle: row.angle ?? null,
        creative_id: matchCreative(row.image, pool)?.id ?? fallback[i],
        source: "spreadsheet" as const,
        status: "draft" as const,
      })),
    )
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ imported: data?.length ?? 0 }, { status: 201 });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { pairWithCreatives } from "@/lib/generation/pairing";
import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  clientId: z.string().uuid(),
  count: z.number().int().min(1).max(50),
});

/**
 * Decides which creative each variation will use, BEFORE the copy is written,
 * and returns what each one depicts.
 *
 * Images are the expensive artifact, so they are fixed first and the copy
 * adapts to them. The same pairing is then applied when the batch is saved, so
 * what the copy was written for is what it actually runs with.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: creatives } = await supabase
    .from("creatives")
    .select("id, created_at, description")
    .eq("client_id", parsed.data.clientId)
    .eq("archived", false);

  const pool = creatives ?? [];
  const pairing = pairWithCreatives(parsed.data.count, pool);
  const byId = new Map(pool.map((c) => [c.id, c.description as string | null]));

  return NextResponse.json({
    creativeIds: pairing,
    descriptions: pairing.map((id) => (id ? (byId.get(id) ?? null) : null)),
    undescribed: pool.filter((c) => !c.description).length,
    total: pool.length,
  });
}

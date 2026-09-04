import { NextResponse } from "next/server";
import { z } from "zod";

import { pairWithCreatives } from "@/lib/generation/pairing";
import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({ clientId: z.string().uuid() });

/**
 * Pairs a client's unpaired variations with its creatives.
 *
 * Copy can arrive before any image exists — imported from a spreadsheet, or
 * generated first — so pairing has to be repeatable rather than a one-shot at
 * save time.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { clientId } = parsed.data;

  const { data: creatives } = await supabase
    .from("creatives")
    .select("id, created_at")
    .eq("client_id", clientId)
    .eq("archived", false);

  if (!creatives?.length) {
    return NextResponse.json(
      { error: "This client has no creatives yet. Upload or generate some first." },
      { status: 400 },
    );
  }

  const { data: unpaired } = await supabase
    .from("ad_variations")
    .select("id")
    .eq("client_id", clientId)
    .is("creative_id", null)
    .in("status", ["draft", "failed"])
    .order("created_at", { ascending: true });

  if (!unpaired?.length) {
    return NextResponse.json({ paired: 0 });
  }

  const pairing = pairWithCreatives(unpaired.length, creatives);

  // One update per row: each gets a different creative, so there is no single
  // statement that covers them.
  await Promise.all(
    unpaired.map((v, i) =>
      supabase.from("ad_variations").update({ creative_id: pairing[i] }).eq("id", v.id),
    ),
  );

  return NextResponse.json({ paired: unpaired.length });
}

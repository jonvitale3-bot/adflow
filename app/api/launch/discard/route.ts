import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  clientId: z.string().uuid(),
  variationIds: z.array(z.string().uuid()).min(1),
});

/**
 * Throws away ads that never reached Meta.
 *
 * A draft, or an attempt that failed, has nothing in the ad account, so this
 * is a plain delete: no job, nothing to undo. That is the difference from
 * rejecting, which pulls a paused ad back out of a client's account and has to
 * be a job because it can fail halfway.
 *
 * Deliberately excludes pushed ads. One exists in the account, and deleting
 * our row would orphan it there with nothing left pointing at it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data, error } = await supabase
    .from("ad_variations")
    .delete()
    .eq("client_id", parsed.data.clientId)
    // A failed attempt never reached Meta either, so it throws away the same
    // way. Only a pushed ad has something in the account to consider.
    .in("status", ["draft", "failed"])
    .in("id", parsed.data.variationIds)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discarded: data?.length ?? 0 });
}

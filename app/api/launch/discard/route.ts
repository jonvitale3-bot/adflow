import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  clientId: z.string().uuid(),
  variationIds: z.array(z.string().uuid()).min(1),
});

/**
 * Throws away drafts.
 *
 * A draft has never reached Meta, so this is a plain delete — no job, no ad to
 * remove from the account. That is the difference from rejecting, which exists
 * to pull a paused ad back out of a client's account and has to be a job
 * because it can fail halfway.
 *
 * Deliberately scoped to drafts. A pushed ad exists in the account, and
 * deleting our row would orphan it there with nothing left pointing at it.
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
    .eq("status", "draft")
    .in("id", parsed.data.variationIds)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ discarded: data?.length ?? 0 });
}

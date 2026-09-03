import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  clientId: z.string().uuid(),
  kind: z.enum(["push", "reject"]),
  variationIds: z.array(z.string().uuid()).min(1).max(200),
  adSetId: z.string().optional(),
  campaignId: z.string().optional(),
});

/** Creates a job and its items. Running it is a separate call, so creation
 *  never blocks on Meta and a page reload cannot duplicate the work. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { clientId, kind, variationIds, adSetId, campaignId } = parsed.data;

  if (kind === "push" && !adSetId) {
    return NextResponse.json({ error: "An ad set is required to push" }, { status: 400 });
  }

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      client_id: clientId,
      kind,
      meta_adset_id: adSetId ?? null,
      meta_campaign_id: campaignId ?? null,
      total_items: variationIds.length,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: itemsError } = await supabase
    .from("job_items")
    .insert(variationIds.map((variation_id) => ({ job_id: job.id, variation_id })));

  if (itemsError) {
    await supabase.from("jobs").delete().eq("id", job.id);
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  // Mark the variations so the UI reflects intent immediately.
  await supabase
    .from("ad_variations")
    .update({ status: kind === "push" ? "pushing" : "rejecting" })
    .in("id", variationIds);

  return NextResponse.json({ jobId: job.id }, { status: 201 });
}

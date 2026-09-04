import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  meta_campaign_id: z.string().nullable().optional(),
  meta_adset_id: z.string().nullable().optional(),
  instagram_account_id: z.string().nullable().optional(),
  default_batch_size: z.number().int().min(1).max(50).optional(),
});

/** Remembering the destination is what removes four clicks from every launch. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { error } = await supabase
    .from("client_launch_defaults")
    .upsert({ client_id: id, ...parsed.data }, { onConflict: "client_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // The Instagram account is an identity, not a destination, and everything
  // that needs it reads the client: the push, the preview, the placement
  // rules. Written here too, because it was only ever stored beside the
  // campaign and ad set, so an account chosen on this screen never reached
  // the ad it was chosen for.
  if (parsed.data.instagram_account_id !== undefined) {
    await supabase
      .from("clients")
      .update({ instagram_account_id: parsed.data.instagram_account_id })
      .eq("id", id);
  }

  return NextResponse.json({ ok: true });
}

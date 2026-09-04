import { NextResponse } from "next/server";
import { z } from "zod";

import { hasDash } from "@/lib/generation/dashes";
import { rewriteWithoutDashes } from "@/lib/generation/rewrite-dashes";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const BodySchema = z.object({
  clientId: z.string().uuid(),
  variationIds: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * Rewrites drafts to remove dashes.
 *
 * Scoped to drafts on purpose. A pushed ad's copy lives in Meta, so editing
 * the row here would leave the two disagreeing while the ad in the account
 * still reads the old way.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: rows } = await supabase
    .from("ad_variations")
    .select("id, headline, primary_text")
    .eq("client_id", parsed.data.clientId)
    .eq("status", "draft")
    .in("id", parsed.data.variationIds);

  const dirty = (rows ?? []).filter((r) => hasDash(r.headline) || hasDash(r.primary_text));
  if (dirty.length === 0) return NextResponse.json({ fixed: 0, fellBack: 0 });

  const rewritten = await rewriteWithoutDashes(
    dirty.map((r) => ({ headline: r.headline, primary_text: r.primary_text })),
  );

  let fixed = 0;
  let fellBack = 0;

  await Promise.all(
    dirty.map(async (row, i) => {
      const next = rewritten[i];
      if (!next) return;
      if (next.headline === row.headline && next.primary_text === row.primary_text) return;

      const { error } = await supabase
        .from("ad_variations")
        .update({ headline: next.headline, primary_text: next.primary_text })
        .eq("id", row.id);

      if (error) return;
      fixed += 1;
      if (next.fellBack) fellBack += 1;
    }),
  );

  return NextResponse.json({ fixed, fellBack });
}

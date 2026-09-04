import { NextResponse } from "next/server";
import { z } from "zod";

import { MetaApiError, uploadAdImage } from "@/lib/meta/client";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const BodySchema = z.object({ clientId: z.string().uuid() });

/** Uploads to Meta in small batches — the original tuned this to 4 to stay
 *  under Meta's throttling and the function's CPU budget. */
const BATCH_SIZE = 4;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, meta_ad_account_id, meta_business")
    .eq("id", parsed.data.clientId)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!client.meta_ad_account_id) {
    return NextResponse.json(
      { error: "This client has no ad account id, so images cannot be uploaded to Meta." },
      { status: 400 },
    );
  }

  const { data: primaries } = await supabase
    .from("creatives")
    .select("id, image_url")
    .eq("client_id", client.id)
    .eq("archived", false)
    .is("meta_image_hash", null);

  // Renditions are images in their own right and need their own hash. The push
  // will upload one it finds missing, but doing it there puts a Graph round
  // trip per size inside the launch, which is the worst moment for it.
  const { data: assets } = await supabase
    .from("creative_assets")
    .select("id, image_url, creatives!inner(client_id, archived)")
    .eq("creatives.client_id", client.id)
    .eq("creatives.archived", false)
    .is("meta_image_hash", null);

  const pending = [
    ...(primaries ?? []).map((row) => ({ ...row, table: "creatives" as const })),
    ...(assets ?? []).map((row) => ({
      id: row.id as string,
      image_url: row.image_url as string,
      table: "creative_assets" as const,
    })),
  ];

  if (!pending.length) {
    return NextResponse.json({ synced: 0, failed: 0, results: [] });
  }

  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);

    const settled = await Promise.all(
      batch.map(async (creative) => {
        try {
          const hash = await uploadAdImage(client.meta_ad_account_id!, creative.image_url, client.meta_business);
          await supabase
            .from(creative.table)
            .update({ meta_image_hash: hash })
            .eq("id", creative.id);
          return { id: creative.id, ok: true };
        } catch (err) {
          const message =
            err instanceof MetaApiError ? err.message : "Upload failed";
          return { id: creative.id, ok: false, error: message };
        }
      }),
    );

    results.push(...settled);

    // A rate limit will not clear by pushing harder; stop and report what got
    // through so the operator can retry rather than burning the whole batch.
    if (settled.some((r) => !r.ok && r.error?.toLowerCase().includes("limit"))) {
      break;
    }
  }

  return NextResponse.json({
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { extendToRatio } from "@/lib/creatives/extend";
import { RATIOS, ratioOf, type Ratio } from "@/lib/creatives/ratios";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const BodySchema = z.object({
  clientId: z.string().uuid(),
  // One creative, or the whole client's library when omitted.
  creativeId: z.string().uuid().optional(),
  // Horizontal is off by default: it serves right column and Audience Network,
  // which is a rounding error of the spend these ads get.
  ratios: z.array(z.enum(["square", "vertical", "horizontal"])).default(["vertical"]),
});

/** Big images are slow to compose; a few at a time keeps the request bounded. */
const CONCURRENCY = 3;

/**
 * Builds the aspect ratios a creative is missing.
 *
 * A designed creative cannot be cropped to another shape without cutting the
 * copy off it, so it is placed whole on a canvas of the target shape over a
 * blurred blow-up of itself. The result fills a story frame instead of
 * letterboxing into one.
 *
 * Explicitly not automatic. This changes what an ad looks like, so it happens
 * when asked for and the result is visible in the grid and in the preview
 * before anything is pushed.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { clientId, creativeId, ratios } = parsed.data;

  let query = supabase
    .from("creatives")
    .select("id, image_url, width, height, creative_assets(ratio)")
    .eq("client_id", clientId)
    .eq("archived", false);
  if (creativeId) query = query.eq("id", creativeId);

  const { data: creatives } = await query;
  if (!creatives?.length) return NextResponse.json({ built: 0, skipped: 0, failed: 0 });

  // Every (creative, missing ratio) pair, flattened so the pool stays busy.
  const work: Array<{ id: string; imageUrl: string; ratio: Ratio }> = [];
  for (const creative of creatives) {
    const assets = (creative.creative_assets ?? []) as Array<{ ratio: Ratio }>;
    const primary =
      creative.width && creative.height
        ? ratioOf(creative.width, creative.height)
        : "square";
    const have = new Set<Ratio>([primary, ...assets.map((a) => a.ratio)]);

    for (const ratio of RATIOS) {
      if (!ratios.includes(ratio) || have.has(ratio)) continue;
      work.push({ id: creative.id, imageUrl: creative.image_url, ratio });
    }
  }

  const skipped = creatives.length * ratios.length - work.length;
  let built = 0;
  let failed = 0;

  const queue = [...work];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        const res = await fetch(item.imageUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Could not read the image (${res.status})`);
        const source = Buffer.from(await res.arrayBuffer());

        const out = await extendToRatio(source, item.ratio);

        const path = `${clientId}/${item.id}_${item.ratio}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("creatives")
          .upload(path, out.buffer, { contentType: "image/jpeg", upsert: true });
        if (uploadError) throw new Error(uploadError.message);

        const {
          data: { publicUrl },
        } = supabase.storage.from("creatives").getPublicUrl(path);

        // The path is deterministic so a rebuild replaces the file rather than
        // littering storage, which means the URL does not change either. Meta
        // and the browser both fetch this URL, so it carries a version or they
        // would be served the image it just replaced.
        const versioned = `${publicUrl}?v=${Date.now()}`;

        const { error: insertError } = await supabase.from("creative_assets").upsert(
          {
            creative_id: item.id,
            ratio: item.ratio,
            storage_path: path,
            image_url: versioned,
            width: out.width,
            height: out.height,
            derived: true,
            // A rebuilt file is a different image, so the old Meta hash is void.
            meta_image_hash: null,
          },
          { onConflict: "creative_id,ratio" },
        );
        if (insertError) throw new Error(insertError.message);

        built += 1;
      } catch {
        // One unreadable image must not stop the rest.
        failed += 1;
      }
    }
  });

  await Promise.all(workers);

  return NextResponse.json({ built, skipped, failed });
}

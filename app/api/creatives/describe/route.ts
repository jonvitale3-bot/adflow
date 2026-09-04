import { NextResponse } from "next/server";
import { z } from "zod";

import { describeFromScene, describeImage } from "@/lib/creatives/describe";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

const BodySchema = z.object({ clientId: z.string().uuid() });

/** Vision calls run a few at a time; all at once trips rate limits. */
const CONCURRENCY = 3;

/**
 * Describes a client's undescribed creatives so copy can be written to them,
 * and records whether copy is baked into each one — which decides whether Meta
 * may reframe it for a placement. Generated images derive both from their
 * scene for free; uploads need looking at, once each.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: pending } = await supabase
    .from("creatives")
    .select("id, image_url, scene, rendered_prompt")
    .eq("client_id", parsed.data.clientId)
    .eq("archived", false)
    // Creatives described before the baked-text question existed are looked at
    // again, once, so the push is not left guessing about them.
    .or("description.is.null,has_baked_text.is.null");

  if (!pending?.length) return NextResponse.json({ described: 0, failed: 0 });

  let described = 0;
  let failed = 0;

  const queue = [...pending];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      try {
        // Free where the scene already says what it depicts. A scene only
        // exists on a generated image, and the image prompt forbids text
        // outright, so those are known-clean without a vision call.
        const fromScene = describeFromScene(item.scene, item.rendered_prompt);
        const look = fromScene
          ? { description: fromScene, hasBakedText: false }
          : await describeImage(item.image_url);

        await supabase
          .from("creatives")
          .update({
            description: look.description,
            has_baked_text: look.hasBakedText,
            described_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        described += 1;
      } catch {
        // One unreadable image must not stop the rest.
        failed += 1;
      }
    }
  });

  await Promise.all(workers);

  return NextResponse.json({ described, failed });
}

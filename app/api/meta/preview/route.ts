import { NextResponse } from "next/server";
import { z } from "zod";

import { mayReframe } from "@/lib/creatives/placement";
import { generatePreview, MetaApiError, type AdFormat } from "@/lib/meta/client";
import { parsePreviewFrame } from "@/lib/meta/preview";
import { appendUrlTags, buildUrlTags } from "@/lib/meta/utm";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const FORMATS = [
  "MOBILE_FEED_STANDARD",
  "DESKTOP_FEED_STANDARD",
  "INSTAGRAM_STANDARD",
  "INSTAGRAM_STORY",
  "FACEBOOK_STORY_MOBILE",
] as const;

const BodySchema = z.object({
  variationId: z.string().uuid(),
  format: z.enum(FORMATS).default("MOBILE_FEED_STANDARD"),
});

/**
 * Renders an ad through Meta's own preview endpoint WITHOUT creating an ad.
 *
 * A mockup can only approximate how the primary text truncates behind
 * "... more", and that truncation is the entire reason the copy rules cap
 * length. This shows the real thing.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: variation } = await supabase
    .from("ad_variations")
    .select(
      "id, headline, primary_text, client_id, creatives(image_url, meta_image_hash, has_baked_text)",
    )
    .eq("id", parsed.data.variationId)
    .single();

  if (!variation) return NextResponse.json({ error: "Variation not found" }, { status: 404 });

  const { data: client } = await supabase
    .from("clients")
    .select(
      "name, meta_ad_account_id, meta_page_id, instagram_account_id, landing_page_url, meta_business",
    )
    .eq("id", variation.client_id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (!client.meta_ad_account_id || !client.meta_page_id) {
    return NextResponse.json(
      { error: "This client needs an ad account and a Page before it can be previewed." },
      { status: 400 },
    );
  }

  const creative = variation.creatives as unknown as
    | { image_url: string; meta_image_hash: string | null; has_baked_text: boolean | null }
    | null;

  const urlTags = buildUrlTags(client.name, variation.headline);
  const link = appendUrlTags(client.landing_page_url ?? "https://example.com", urlTags);

  // A hash is preferred, but a preview can render straight from the public URL,
  // so an image that has not been uploaded to Meta yet still previews.
  const linkData: Record<string, unknown> = {
    message: variation.primary_text,
    name: variation.headline,
    link,
    call_to_action: { type: "LEARN_MORE" },
  };
  if (creative?.meta_image_hash) linkData.image_hash = creative.meta_image_hash;
  else if (creative?.image_url) linkData.picture = creative.image_url;

  const storySpec: Record<string, unknown> = {
    page_id: client.meta_page_id,
    link_data: linkData,
  };
  // Instagram placements render as the linked IG account when there is one.
  if (client.instagram_account_id) {
    storySpec.instagram_actor_id = client.instagram_account_id;
  }

  try {
    const body = await generatePreview(
      client.meta_ad_account_id,
      {
        // The endpoint takes a whole ad creative, not a story spec. Passing the
        // story spec bare makes Meta render "Ad Incomplete", because from its
        // side the creative has no object_story_spec at all.
        object_story_spec: storySpec,
        // Mirrors the push, so the preview shows the reframing the ad will
        // actually get rather than a version Meta is free to recrop.
        degrees_of_freedom_spec: {
          creative_features_spec: {
            adapt_to_placement: {
              enroll_status: mayReframe(creative?.has_baked_text) ? "OPT_IN" : "OPT_OUT",
            },
          },
        },
      },
      parsed.data.format as AdFormat,
      client.meta_business,
    );

    const frame = parsePreviewFrame(body);
    if (!frame) {
      return NextResponse.json(
        { error: "Meta returned no preview for that format." },
        { status: 502 },
      );
    }

    return NextResponse.json(frame);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof MetaApiError
            ? err.message
            : "Could not render a preview",
      },
      { status: 502 },
    );
  }
}

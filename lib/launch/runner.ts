import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { mayReframe } from "@/lib/creatives/placement";
import {
  createAd,
  createAdCreative,
  deleteAd,
  MetaApiError,
  uploadAdImage,
} from "@/lib/meta/client";
import { appendUrlTags, buildAdName, buildUrlTags } from "@/lib/meta/utm";

/**
 * Push and reject as resumable jobs.
 *
 * The Lovable build pushed sequentially inside one request, so a timeout left
 * ads half-created with no record of which. Every unit of work is a job_items
 * row here: a timeout is an interruption the runner picks up on the next
 * invocation, and nothing is done twice.
 */

const CONCURRENCY = 3;
const MAX_ATTEMPTS = 3;

type Db = SupabaseClient;

export interface RunResult {
  jobId: string;
  completed: number;
  failed: number;
  remaining: number;
  status: "running" | "succeeded" | "failed";
}

interface ClientContext {
  id: string;
  name: string;
  meta_ad_account_id: string | null;
  meta_page_id: string | null;
  meta_pixel_id: string | null;
  instagram_account_id: string | null;
  landing_page_url: string | null;
  meta_business: string | null;
  timezone?: string | null;
}

/** Pulls the next queued items and marks them running in one step. */
async function claimItems(db: Db, jobId: string, limit: number) {
  const { data } = await db
    .from("job_items")
    .select("id, variation_id, attempts")
    .eq("job_id", jobId)
    .eq("status", "queued")
    .lt("attempts", MAX_ATTEMPTS)
    .limit(limit);

  if (!data?.length) return [];

  await db
    .from("job_items")
    .update({ status: "running" })
    .in("id", data.map((i) => i.id));

  return data;
}

async function pushOne(
  db: Db,
  client: ClientContext,
  adSetId: string,
  variationId: string,
): Promise<void> {
  const { data: variation } = await db
    .from("ad_variations")
    .select(
      "id, headline, primary_text, meta_ad_id, creative_id, creatives(id, image_url, meta_image_hash, has_baked_text)",
    )
    .eq("id", variationId)
    .single();

  if (!variation) throw new Error("Variation not found");

  // Idempotency: an item retried after a timeout must not create a second ad.
  if (variation.meta_ad_id) return;

  let creative = variation.creatives as unknown as PairedCreative | null;

  // Pair late when the variation has no creative yet.
  //
  // Pairing normally happens when a batch is saved, but copy can legitimately
  // come first — imported from a spreadsheet, or generated before the images
  // exist. Without this, that copy could never be pushed no matter how many
  // creatives were added afterwards.
  if (!creative) {
    creative = await pairLate(db, client.id, variationId);
    if (!creative) {
      throw new Error(
        "This client has no creatives, so there is no image to attach. Upload or generate one, then push again.",
      );
    }
  }
  if (!client.meta_ad_account_id) throw new Error("Client has no ad account id");
  if (!client.meta_page_id) throw new Error("Client has no Facebook Page id");

  // Reuse the stored hash when there is one; upload and persist otherwise, so
  // repeated pushes stop re-uploading the same image.
  let imageHash = creative.meta_image_hash;
  if (!imageHash) {
    imageHash = await uploadAdImage(
      client.meta_ad_account_id,
      creative.image_url,
      client.meta_business,
    );
    await db.from("creatives").update({ meta_image_hash: imageHash }).eq("id", creative.id);
  }

  const adaptToPlacement = mayReframe(creative.has_baked_text);

  const urlTags = buildUrlTags(client.name, variation.headline);
  const link = appendUrlTags(client.landing_page_url ?? "", urlTags);
  if (!client.landing_page_url) {
    // The old build silently substituted https://example.com here, which
    // creates a live ad pointing at nothing.
    throw new Error("Client has no landing page URL");
  }

  let metaCreativeId: string;
  try {
    metaCreativeId = await createAdCreative({
      adAccountId: client.meta_ad_account_id,
      pageId: client.meta_page_id,
      instagramAccountId: client.instagram_account_id ?? undefined,
      name: `${client.name} — ${variation.headline}`,
      message: variation.primary_text,
      headline: variation.headline,
      link,
      imageHash,
      urlTags,
      adaptToPlacement,
      business: client.meta_business,
    });
  } catch (err) {
    // Supplying an Instagram actor fails when the Page has no linked IG
    // business account, and the error is opaque. Retry once without it.
    if (client.instagram_account_id && err instanceof MetaApiError) {
      metaCreativeId = await createAdCreative({
        adAccountId: client.meta_ad_account_id,
        pageId: client.meta_page_id,
        name: `${client.name} — ${variation.headline}`,
        message: variation.primary_text,
        headline: variation.headline,
        link,
        imageHash,
        urlTags,
        adaptToPlacement,
        business: client.meta_business,
      });
    } else {
      throw err;
    }
  }

  const adId = await createAd({
    adAccountId: client.meta_ad_account_id,
    adSetId,
    creativeId: metaCreativeId,
    name: buildAdName(client.name, variation.headline, client.timezone ?? "America/New_York"),
    pixelId: client.meta_pixel_id ?? undefined,
    business: client.meta_business,
  });

  await db
    .from("ad_variations")
    .update({
      meta_ad_id: adId,
      meta_creative_id: metaCreativeId,
      meta_adset_id: adSetId,
      status: "pushed",
      error: null,
    })
    .eq("id", variationId);
}

/**
 * Assigns a creative to a variation that has none, spreading choices across the
 * library rather than putting the same image on every late-paired ad.
 */
/** What the push needs to know about the image an ad will run with. */
interface PairedCreative {
  id: string;
  image_url: string;
  meta_image_hash: string | null;
  /** NULL until the vision pass has looked; treated as true. */
  has_baked_text: boolean | null;
}

async function pairLate(
  db: Db,
  clientId: string,
  variationId: string,
): Promise<PairedCreative | null> {
  const { data: creatives } = await db
    .from("creatives")
    .select("id, image_url, meta_image_hash, has_baked_text, created_at")
    .eq("client_id", clientId)
    .eq("archived", false)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (!creatives?.length) return null;

  // Spread by how many variations already point at each creative, so a late
  // batch does not pile onto the first image.
  const { data: used } = await db
    .from("ad_variations")
    .select("creative_id")
    .eq("client_id", clientId)
    .not("creative_id", "is", null);

  const counts = new Map<string, number>();
  for (const row of used ?? []) {
    const id = row.creative_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const chosen = creatives.reduce((best, c) =>
    (counts.get(c.id) ?? 0) < (counts.get(best.id) ?? 0) ? c : best,
  );

  await db.from("ad_variations").update({ creative_id: chosen.id }).eq("id", variationId);

  return {
    id: chosen.id,
    image_url: chosen.image_url,
    meta_image_hash: chosen.meta_image_hash,
    has_baked_text: chosen.has_baked_text,
  };
}

async function rejectOne(db: Db, variationId: string, business: string | null): Promise<void> {
  const { data: variation } = await db
    .from("ad_variations")
    .select("id, meta_ad_id")
    .eq("id", variationId)
    .single();

  if (!variation) throw new Error("Variation not found");

  // Already gone from Meta; just settle the row.
  if (variation.meta_ad_id) {
    await deleteAd(variation.meta_ad_id, business);
  }

  await db
    .from("ad_variations")
    .update({ status: "rejected", meta_ad_id: null, error: null })
    .eq("id", variationId);
}

/**
 * Processes a slice of a job. Safe to call repeatedly: it claims only queued
 * items, so a second invocation after a timeout resumes rather than repeats.
 */
export async function runJobSlice(db: Db, jobId: string): Promise<RunResult> {
  const { data: job } = await db
    .from("jobs")
    .select("id, client_id, kind, status, meta_adset_id")
    .eq("id", jobId)
    .single();

  if (!job) throw new Error("Job not found");

  const { data: client } = await db
    .from("clients")
    .select(
      "id, name, meta_ad_account_id, meta_page_id, meta_pixel_id, instagram_account_id, landing_page_url, meta_business",
    )
    .eq("id", job.client_id)
    .single();

  if (!client) throw new Error("Client not found");

  if (job.status === "queued") {
    await db
      .from("jobs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", jobId);
  }

  const items = await claimItems(db, jobId, CONCURRENCY * 2);

  if (items.length > 0) {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          if (job.kind === "push") {
            await pushOne(db, client as ClientContext, job.meta_adset_id!, item.variation_id);
          } else {
            await rejectOne(db, item.variation_id, (client as ClientContext).meta_business);
          }
          await db
            .from("job_items")
            .update({ status: "succeeded", finished_at: new Date().toISOString() })
            .eq("id", item.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed";
          const attempts = item.attempts + 1;
          const retryable = err instanceof MetaApiError && err.isRetryable;
          // A retryable failure goes back in the queue until it runs out of
          // attempts; anything else is final, so a bad landing page URL is not
          // tried three times.
          await db
            .from("job_items")
            .update({
              status: retryable && attempts < MAX_ATTEMPTS ? "queued" : "failed",
              attempts,
              error: message,
              finished_at: retryable && attempts < MAX_ATTEMPTS ? null : new Date().toISOString(),
            })
            .eq("id", item.id);

          if (!retryable || attempts >= MAX_ATTEMPTS) {
            await db
              .from("ad_variations")
              .update({ status: "failed", error: message })
              .eq("id", item.variation_id);
          }
        }
      }
    });
    await Promise.all(workers);
  }

  const { count: completed } = await db
    .from("job_items")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "succeeded");

  const { count: failed } = await db
    .from("job_items")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "failed");

  const { count: remaining } = await db
    .from("job_items")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("status", ["queued", "running"]);

  const done = (remaining ?? 0) === 0;
  const status = done ? ((failed ?? 0) > 0 ? "failed" : "succeeded") : "running";

  await db
    .from("jobs")
    .update({
      status,
      completed_items: completed ?? 0,
      failed_items: failed ?? 0,
      ...(done ? { finished_at: new Date().toISOString() } : {}),
    })
    .eq("id", jobId);

  return {
    jobId,
    completed: completed ?? 0,
    failed: failed ?? 0,
    remaining: remaining ?? 0,
    status: status as RunResult["status"],
  };
}

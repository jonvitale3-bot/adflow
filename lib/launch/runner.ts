import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { mayReframe } from "@/lib/creatives/placement";
import { ratioOf, type Ratio } from "@/lib/creatives/ratios";
import { buildAssetFeedSpec, type RatioAsset } from "@/lib/meta/asset-feed";
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
  run: RunState,
): Promise<void> {
  const { data: variation } = await db
    .from("ad_variations")
    .select(
      "id, headline, primary_text, meta_ad_id, creative_id, creatives(id, image_url, meta_image_hash, has_baked_text, width, height)",
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

  // Per-placement assets, when this creative has any and the account has not
  // already refused them in this run.
  const assetFeedSpec = run.perPlacementRejected
    ? null
    : buildAssetFeedSpec({
        assets: await syncRatioAssets(db, client, creative, imageHash),
        message: variation.primary_text,
        headline: variation.headline,
        link,
        hasInstagram: Boolean(client.instagram_account_id),
      });

  const base = {
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
  };

  // Tried in order, best first. Two things can be rejected independently:
  // an Instagram actor the Page has no linked account for, and a
  // per-placement spec the account will not take. Neither is worth failing a
  // launch over when a plainer creative would have gone through, so the ad
  // lands and the review grid says what was given up.
  const igVariants = client.instagram_account_id
    ? [client.instagram_account_id, undefined]
    : [undefined];
  const specVariants = assetFeedSpec ? [assetFeedSpec, null] : [null];

  let metaCreativeId: string | null = null;
  let pushNote: string | null = run.perPlacementRejected
    ? `Launched with one image for every placement. Meta rejected the per-placement version earlier in this launch: ${run.perPlacementRejected}`
    : null;
  let lastError: unknown = null;

  // Every rung of the ladder is recorded, because reporting only the last one
  // makes four different rejections look like a single unexplained failure.
  const tried: string[] = [];

  outer: for (const spec of specVariants) {
    for (const instagramAccountId of igVariants) {
      const label = `${spec ? "per-placement" : "one image"}, ${
        instagramAccountId ? "with Instagram" : "no Instagram"
      }`;
      try {
        metaCreativeId = await createAdCreative({
          ...base,
          instagramAccountId,
          assetFeedSpec: spec,
        });
        if (assetFeedSpec && !spec) {
          const reason = lastError instanceof Error ? lastError.message : "unknown error";
          // Remembered for the rest of the run, so the remaining ads go
          // straight to the creative that works.
          run.perPlacementRejected ??= reason;
          pushNote = `Launched with one image for every placement. Meta rejected the per-placement version: ${reason}`;
        }
        break outer;
      } catch (err) {
        if (!(err instanceof MetaApiError)) throw err;
        lastError = err;
        tried.push(`${label} → ${err.message}`);
      }
    }
  }

  if (!metaCreativeId) {
    throw new Error(`No creative was accepted. Tried: ${tried.join("  ·  ")}`);
  }

  // Labelled separately from the creative attempts. The two fail for different
  // reasons and need different fixes, and an unlabelled message here reads as
  // though the creative was the problem when it was accepted.
  const adId = await createAdOrExplain({
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
      push_note: pushNote,
      status: "pushed",
      error: null,
    })
    .eq("id", variationId);
}

/**
 * Assigns a creative to a variation that has none, spreading choices across the
 * library rather than putting the same image on every late-paired ad.
 */
/**
 * The renditions this ad can be delivered with, each carrying a Meta hash.
 *
 * The primary image is always included as the square — it is what every
 * existing creative is, and it is the shape Meta falls back to. Additional
 * renditions are uploaded on first use and remembered, so a second push of the
 * same creative costs nothing.
 *
 * An upload that fails is dropped rather than fatal: losing the vertical costs
 * a well-framed story, while failing the push costs the whole ad.
 */
async function syncRatioAssets(
  db: Db,
  client: ClientContext,
  creative: PairedCreative,
  primaryHash: string,
): Promise<RatioAsset[]> {
  const { data: rows } = await db
    .from("creative_assets")
    .select("id, ratio, image_url, meta_image_hash")
    .eq("creative_id", creative.id);

  const assets: RatioAsset[] = [
    { ratio: ratioOfCreative(creative), imageHash: primaryHash },
  ];
  if (!rows?.length) return assets;

  for (const row of rows) {
    const ratio = row.ratio as Ratio;
    // The primary already covers its own ratio.
    if (assets.some((a) => a.ratio === ratio)) continue;

    try {
      let hash = row.meta_image_hash as string | null;
      if (!hash) {
        hash = await uploadAdImage(
          client.meta_ad_account_id!,
          row.image_url as string,
          client.meta_business,
        );
        await db.from("creative_assets").update({ meta_image_hash: hash }).eq("id", row.id);
      }
      assets.push({ ratio, imageHash: hash });
    } catch {
      // Deliver what did upload.
    }
  }

  return assets;
}

/**
 * The primary image's own shape. NULL dimensions predate the column and are
 * square — every creative in the library at that point was.
 */
function ratioOfCreative(creative: PairedCreative): Ratio {
  if (!creative.width || !creative.height) return "square";
  return ratioOf(creative.width, creative.height);
}

/** Creates the ad, saying so when it is the ad rather than the creative. */
async function createAdOrExplain(input: Parameters<typeof createAd>[0]): Promise<string> {
  try {
    return await createAd(input);
  } catch (err) {
    if (!(err instanceof MetaApiError)) throw err;
    throw new Error(`The creative was accepted but the ad was rejected: ${err.message}`);
  }
}

/**
 * What this run has learned about the account, shared across its workers.
 *
 * Per-placement creative is either accepted by an ad account or it is not, and
 * the answer does not change between two ads pushed a second apart. Finding
 * out once and remembering costs one rejected call; finding out per ad doubles
 * every launch's calls to Meta and is a good way to be rate limited into
 * failing ads that would otherwise have gone through.
 */
interface RunState {
  perPlacementRejected: string | null;
}

/** What the push needs to know about the image an ad will run with. */
interface PairedCreative {
  id: string;
  image_url: string;
  meta_image_hash: string | null;
  /** NULL until the vision pass has looked; treated as true. */
  has_baked_text: boolean | null;
  width: number | null;
  height: number | null;
}

async function pairLate(
  db: Db,
  clientId: string,
  variationId: string,
): Promise<PairedCreative | null> {
  const { data: creatives } = await db
    .from("creatives")
    .select("id, image_url, meta_image_hash, has_baked_text, width, height, created_at")
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
    width: chosen.width,
    height: chosen.height,
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

  // Shared by this slice's workers. It does not need to survive a resume: a
  // later slice re-learns it on its first ad, which costs one call.
  const run: RunState = { perPlacementRejected: null };

  if (items.length > 0) {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          if (job.kind === "push") {
            await pushOne(
              db,
              client as ClientContext,
              job.meta_adset_id!,
              item.variation_id,
              run,
            );
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

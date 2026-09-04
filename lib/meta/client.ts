import "server-only";

import { env } from "@/lib/env";

import { tokenForBusiness } from "./tokens.ts";

import { MetaApiError, toMetaError } from "./errors";

const GRAPH_BASE = "https://graph.facebook.com";

/** One version for the whole app. The old build mixed v19.0 and v21.0 across
 *  six files, so behaviour differed depending on which one you hit. */
const VERSION = env.META_GRAPH_VERSION;

/** Meta caps most edges well below this; 200 is the practical maximum. */
const PAGE_SIZE = 200;

/** Stop runaway pagination on an account with pathological history. */
const MAX_PAGES = 25;

interface Paged<T> {
  data?: T[];
  paging?: { next?: string; cursors?: { after?: string } };
}

function url(path: string, params: Record<string, string | undefined> = {}): string {
  const u = new URL(`${GRAPH_BASE}/${VERSION}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) u.searchParams.set(k, v);
  }
  return u.toString();
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Meta occasionally returns an HTML error page from the edge.
    throw new MetaApiError(`Non-JSON response from Meta (${res.status})`, {
      status: res.status,
    });
  }
}

async function request<T>(
  input: string,
  init: RequestInit & { business?: string | null } = {},
): Promise<T> {
  const token = tokenForBusiness(init.business);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers, cache: "no-store" });
  const body = await parse(res);

  if (!res.ok) throw toMetaError(res.status, body);
  return body as T;
}

/**
 * Follows `paging.next` to exhaustion. The old build did not paginate
 * campaigns or ad sets at all, so long-tail accounts silently showed a
 * truncated list and ads went to the wrong place.
 */
async function paginate<T>(first: string, business?: string | null): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = first;

  for (let page = 0; page < MAX_PAGES && next; page++) {
    const body: Paged<T> = await request<Paged<T>>(next, { business });
    if (body.data?.length) out.push(...body.data);
    next = body.paging?.next;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export interface AdAccount {
  id: string;
  account_id: string;
  name: string;
  account_status: number;
  business?: { name?: string };
}

export function listAdAccounts(business?: string | null): Promise<AdAccount[]> {
  return paginate<AdAccount>(
    url("me/adaccounts", {
      fields: "id,account_id,name,account_status,business{name}",
      limit: String(PAGE_SIZE),
    }),
    business,
  );
}

export interface Page {
  id: string;
  name: string;
}

export function listPages(business?: string | null): Promise<Page[]> {
  return paginate<Page>(
    url("me/accounts", { fields: "id,name", limit: String(PAGE_SIZE) }),
    business,
  );
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
}

export function listCampaigns(adAccountId: string, business?: string | null): Promise<Campaign[]> {
  return paginate<Campaign>(
    url(`${adAccountId}/campaigns`, {
      fields: "id,name,status,objective",
      limit: String(PAGE_SIZE),
    }),
    business,
  );
}

export interface AdSet {
  id: string;
  name: string;
  status: string;
}

export function listAdSets(campaignId: string, business?: string | null): Promise<AdSet[]> {
  return paginate<AdSet>(
    url(`${campaignId}/adsets`, {
      fields: "id,name,status",
      limit: String(PAGE_SIZE),
    }),
    business,
  );
}

export interface InstagramAccount {
  id: string;
  username?: string;
}

/**
 * Instagram identities come from up to three edges and no single one is
 * reliable, so results are merged and deduped. Each is caught individually:
 * a Page without a linked IG business account errors rather than returning
 * empty, and that must not fail the whole lookup.
 *
 * Unlike the old build, `pageId` is actually threaded through by callers —
 * previously it was never passed, so two of these three never ran.
 */
export async function listInstagramAccounts(
  adAccountId: string,
  pageId?: string,
  business?: string | null,
): Promise<InstagramAccount[]> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const sources: Array<() => Promise<InstagramAccount[]>> = [
    () =>
      paginate<InstagramAccount>(
        url(`${acct}/instagram_accounts`, { fields: "id,username", limit: "100" }),
        business,
      ),
  ];

  if (pageId) {
    sources.push(() =>
      paginate<InstagramAccount>(
        url(`${pageId}/instagram_accounts`, { fields: "id,username", limit: "100" }),
        business,
      ),
    );
    sources.push(async () => {
      const body = await request<{
        instagram_business_account?: InstagramAccount;
      }>(url(pageId, { fields: "instagram_business_account{id,username}" }), { business });
      return body.instagram_business_account ? [body.instagram_business_account] : [];
    });
  }

  const settled = await Promise.allSettled(sources.map((fn) => fn()));
  const merged = new Map<string, InstagramAccount>();

  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const account of result.value) {
      if (!merged.has(account.id)) merged.set(account.id, account);
    }
  }

  return [...merged.values()];
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * Uploads an image to the ad account's image library and returns its hash.
 *
 * Posts the blob directly as multipart rather than base64-encoding it in
 * 8KB chunks through `String.fromCharCode`, which was O(n) string
 * concatenation over multi-megabyte images and CPU-bound inside the function.
 */
export async function uploadAdImage(
  adAccountId: string,
  imageUrl: string,
  business?: string | null,
): Promise<string> {
  const src = await fetch(imageUrl, { cache: "no-store" });
  if (!src.ok) {
    throw new MetaApiError(`Could not fetch creative image (${src.status})`, {
      status: src.status,
    });
  }

  const contentType = src.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    // A public URL returning HTML means the storage bucket lost public read,
    // which silently breaks every push. See docs/SPEC.md §9 rule 12.
    throw new MetaApiError(
      "Creative URL returned HTML, not an image — check the storage bucket is public-read.",
      { status: 400 },
    );
  }

  const blob = await src.blob();
  const form = new FormData();
  form.append("source", blob, "creative.jpg");

  const body = await request<{ images?: Record<string, { hash?: string }> }>(
    url(`${adAccountId}/adimages`),
    { method: "POST", body: form, business },
  );

  // The response is keyed by an unpredictable filename, not a fixed field.
  const first = Object.values(body.images ?? {})[0];
  if (!first?.hash) {
    throw new MetaApiError("Meta accepted the image but returned no hash", {
      status: 502,
    });
  }

  return first.hash;
}

// ---------------------------------------------------------------------------
// Creatives and ads
// ---------------------------------------------------------------------------

export interface CreateCreativeInput {
  adAccountId: string;
  pageId: string;
  instagramAccountId?: string;
  name: string;
  message: string;
  headline: string;
  link: string;
  imageHash: string;
  urlTags: string;
  business?: string | null;
}

export async function createAdCreative(input: CreateCreativeInput): Promise<string> {
  const spec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: {
      message: input.message,
      name: input.headline,
      link: input.link,
      image_hash: input.imageHash,
      call_to_action: { type: "LEARN_MORE" },
    },
  };

  if (input.instagramAccountId) {
    spec.instagram_actor_id = input.instagramAccountId;
  }

  const form = new URLSearchParams({
    name: input.name,
    object_story_spec: JSON.stringify(spec),
    url_tags: input.urlTags,
    degrees_of_freedom_spec: JSON.stringify({
      creative_features_spec: {
        adapt_to_placement: { enroll_status: "OPT_IN" },
        media_liquidity_animated_image: { enroll_status: "OPT_IN" },
      },
    }),
  });

  const body = await request<{ id: string }>(url(`${input.adAccountId}/adcreatives`), {
    method: "POST",
    body: form,
    business: input.business,
  });

  return body.id;
}

export interface CreateAdInput {
  adAccountId: string;
  adSetId: string;
  creativeId: string;
  name: string;
  pixelId?: string;
  business?: string | null;
}

/** Always PAUSED. This tool never activates an ad. docs/SPEC.md §9 rule 10. */
export async function createAd(input: CreateAdInput): Promise<string> {
  const form = new URLSearchParams({
    name: input.name,
    adset_id: input.adSetId,
    creative: JSON.stringify({ creative_id: input.creativeId }),
    status: "PAUSED",
  });

  if (input.pixelId) {
    form.set(
      "tracking_specs",
      JSON.stringify([
        { "action.type": ["offsite_conversion"], fb_pixel: [input.pixelId] },
      ]),
    );
  }

  const body = await request<{ id: string }>(url(`${input.adAccountId}/ads`), {
    method: "POST",
    body: form,
    business: input.business,
  });

  return body.id;
}

/**
 * Deletes an ad. Required because the review gate sits after creation:
 * rejecting must remove the draft from the client's account, not just mark a
 * row. The old build had no equivalent.
 */
export async function deleteAd(adId: string, business?: string | null): Promise<void> {
  await request<{ success?: boolean }>(url(adId), { method: "DELETE", business });
}

// ---------------------------------------------------------------------------
// Previews
// ---------------------------------------------------------------------------

/** Confirm against live Graph docs — the placement list changes over time. */
export type AdFormat =
  | "MOBILE_FEED_STANDARD"
  | "DESKTOP_FEED_STANDARD"
  | "INSTAGRAM_STANDARD"
  | "INSTAGRAM_STORY"
  | "FACEBOOK_STORY_MOBILE";

/**
 * Renders a real preview from a creative spec WITHOUT creating an ad, so the
 * pre-launch review shows Meta's own rendering — including how the primary
 * text truncates behind "... more", which is the entire reason the copy prompt
 * enforces a 7-line limit.
 */
export async function generatePreview(
  adAccountId: string,
  creativeSpec: Record<string, unknown>,
  format: AdFormat = "MOBILE_FEED_STANDARD",
): Promise<string | null> {
  const body = await request<Paged<{ body?: string }>>(
    url(`${adAccountId}/generatepreviews`, {
      creative: JSON.stringify(creativeSpec),
      ad_format: format,
    }),
  );

  return body.data?.[0]?.body ?? null;
}

/** Preview for an ad that already exists — the post-launch review gate. */
export async function getAdPreview(
  adId: string,
  format: AdFormat = "MOBILE_FEED_STANDARD",
): Promise<string | null> {
  const body = await request<Paged<{ body?: string }>>(
    url(`${adId}/previews`, { ad_format: format }),
  );

  return body.data?.[0]?.body ?? null;
}

export { MetaApiError };

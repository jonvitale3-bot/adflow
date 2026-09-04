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
  init: RequestInit & { business?: string | null; token?: string } = {},
): Promise<T> {
  // An explicit token is for the endpoints that will not take the system user
  // one: several Page edges require a Page access token specifically, and
  // refuse everything else with "(#190) This method must be called with a Page
  // Access Token".
  const token = init.token ?? tokenForBusiness(init.business);
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
async function paginate<T>(
  first: string,
  business?: string | null,
  token?: string,
): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = first;

  for (let page = 0; page < MAX_PAGES && next; page++) {
    const body: Paged<T> = await request<Paged<T>>(next, { business, token });
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

/**
 * Pages the token can create ads as.
 *
 * `/me/accounts` returns Pages the user holds a role on, which is a narrower
 * and subtly different set — a Page can be assigned to a system user for
 * advertising without appearing there, and several were. `promote_pages` is
 * scoped to exactly the question that matters: can this token run an ad as
 * this Page. Falls back to /me/accounts when no ad account is given.
 */
export function listPages(
  business?: string | null,
  adAccountId?: string | null,
): Promise<Page[]> {
  const path = adAccountId
    ? `${adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`}/promote_pages`
    : "me/accounts";

  return paginate<Page>(
    url(path, { fields: "id,name", limit: String(PAGE_SIZE) }),
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
  /**
   * A Page-backed Instagram account: the stand-in Meta uses so a Facebook Page
   * can represent the business on Instagram when there is no real Instagram
   * account. Worth labelling, because it is not an account anyone can post
   * from.
   */
  pageBacked?: boolean;
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
export interface InstagramLookup {
  accounts: InstagramAccount[];
  /**
   * What each endpoint said. Four sources are tried and merged, and until this
   * existed a failure was indistinguishable from an empty result: the picker
   * showed nothing either way, with no way to tell whether the account has no
   * Instagram identity or the token cannot see one.
   */
  attempts: Array<{ source: string; ok: boolean; found: number; error?: string }>;
}

/**
 * The Page's own access token.
 *
 * A system user token can read one for any Page it has been assigned to in
 * Business Manager, and several Page edges accept nothing else. Returns null
 * rather than throwing, because every caller has something else to try.
 */
async function pageAccessToken(
  pageId: string,
  business?: string | null,
): Promise<string | null> {
  try {
    const body = await request<{ access_token?: string }>(
      url(pageId, { fields: "access_token" }),
      { business },
    );
    return body.access_token ?? null;
  } catch {
    return null;
  }
}

export async function listInstagramAccounts(
  adAccountId: string,
  pageId?: string,
  business?: string | null,
): Promise<InstagramLookup> {
  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const sources: Array<{ name: string; run: () => Promise<InstagramAccount[]> }> = [
    {
      name: "ad account instagram_accounts",
      run: () =>
        paginate<InstagramAccount>(
          url(`${acct}/instagram_accounts`, { fields: "id,username", limit: "100" }),
          business,
        ),
    },
    // The newer edge. The one above predates it and is empty on accounts where
    // the identity was linked through Business settings rather than the Page.
    {
      name: "ad account connected_instagram_accounts",
      run: () =>
        paginate<InstagramAccount>(
          url(`${acct}/connected_instagram_accounts`, { fields: "id,username", limit: "100" }),
          business,
        ),
    },
  ];

  // Fetched once and shared: the Page edges below refuse the system user token.
  const pageToken = pageId ? await pageAccessToken(pageId, business) : null;

  if (pageId) {
    sources.push({
      name: "page instagram_accounts",
      run: () =>
        paginate<InstagramAccount>(
          url(`${pageId}/instagram_accounts`, { fields: "id,username", limit: "100" }),
          business,
          pageToken ?? undefined,
        ),
    });
    sources.push({
      name: "page instagram_business_account",
      run: async () => {
        const body = await request<{
          instagram_business_account?: InstagramAccount;
        }>(url(pageId, { fields: "instagram_business_account{id,username}" }), {
          business,
          token: pageToken ?? undefined,
        });
        return body.instagram_business_account ? [body.instagram_business_account] : [];
      },
    });

    // The Page-backed account, which is what Meta falls back to on its own
    // when an ad runs on Instagram with only a Page behind it. It is the
    // identity that appears on the draft in Ads Manager, and without naming it
    // a creative cannot claim an Instagram placement at all. Listed last, so a
    // real Instagram account is preferred where one exists.
    // What Ads Manager itself shows under "Instagram profile": the account
    // connected to the Page for advertising. It is a separate edge from the
    // Page's own Instagram accounts, and a Page can have this and nothing else.
    sources.push({
      name: "page connected_instagram_account",
      run: async () => {
        const body = await request<{
          connected_instagram_account?: InstagramAccount;
        }>(url(pageId, { fields: "connected_instagram_account{id,username}" }), {
          business,
          token: pageToken ?? undefined,
        });
        return body.connected_instagram_account ? [body.connected_instagram_account] : [];
      },
    });

    sources.push({
      name: "page_backed_instagram_accounts",
      run: async () => {
        const rows = await paginate<InstagramAccount>(
          url(`${pageId}/page_backed_instagram_accounts`, {
            fields: "id,username",
            limit: "25",
          }),
          business,
          pageToken ?? undefined,
        );
        return rows.map((row) => ({ ...row, pageBacked: true }));
      },
    });
  }

  const settled = await Promise.allSettled(sources.map((source) => source.run()));
  const merged = new Map<string, InstagramAccount>();
  const attempts: InstagramLookup["attempts"] = [];

  // Reported first, because when the Page edges fail this is usually why.
  if (pageId) {
    attempts.push({
      source: "page access token",
      ok: Boolean(pageToken),
      found: pageToken ? 1 : 0,
      error: pageToken
        ? undefined
        : "Not available. The system user needs a role on this Page in Business Manager.",
    });
  }

  for (const [i, result] of settled.entries()) {
    const name = sources[i]!.name;
    if (result.status !== "fulfilled") {
      attempts.push({
        source: name,
        ok: false,
        found: 0,
        error: result.reason instanceof Error ? result.reason.message : "Request failed",
      });
      continue;
    }
    attempts.push({ source: name, ok: true, found: result.value.length });
    for (const account of result.value) {
      if (!merged.has(account.id)) merged.set(account.id, account);
    }
  }

  return { accounts: [...merged.values()], attempts };
}

/**
 * Creates the Page-backed Instagram account.
 *
 * Meta makes one of these by itself the first time an ad needs an Instagram
 * identity, but a creative cannot claim an Instagram placement before it
 * exists, so an ad built with per-placement assets has to ask for it up front.
 * It belongs to the Page, is used only by ads, and nobody posts from it.
 */
export async function createPageBackedInstagramAccount(
  pageId: string,
  business?: string | null,
): Promise<InstagramAccount> {
  const token = await pageAccessToken(pageId, business);
  const body = await request<{ id: string }>(
    url(`${pageId}/page_backed_instagram_accounts`),
    {
      method: "POST",
      body: new URLSearchParams(),
      business,
      token: token ?? undefined,
    },
  );
  return { id: body.id, pageBacked: true };
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
  /**
   * Which field carries the Instagram identity.
   *
   * Meta has two, and they take different kinds of id. instagram_actor_id is
   * the older one and wants a legacy actor id; instagram_user_id is its
   * replacement and takes the Instagram account id Business Settings shows,
   * the one beginning 17841. Handing the second kind to the first field fails
   * with "(#100) Param instagram_actor_id must be a valid Instagram account
   * id", which reads like a permissions problem and is not one.
   */
  instagramField?: "instagram_user_id" | "instagram_actor_id";
  name: string;
  message: string;
  headline: string;
  link: string;
  imageHash: string;
  urlTags: string;
  business?: string | null;
  /**
   * Whether Meta may reframe this image for each placement. False whenever the
   * image carries designed-in copy — cropping a square to 9:16 takes the
   * corner an offer badge sits in, and the ad runs with half a price on it.
   */
  adaptToPlacement: boolean;
  /**
   * Per-placement assets. When present, the creative is built from an
   * asset_feed_spec instead of link_data: each image is delivered to the
   * placements it was designed for, and Meta reframes nothing.
   */
  assetFeedSpec?: Record<string, unknown> | null;
}

export async function createAdCreative(input: CreateCreativeInput): Promise<string> {
  // With per-placement assets the images, copy and link all live in the asset
  // feed, so the story spec carries only the identities the ad runs as.
  const spec: Record<string, unknown> = input.assetFeedSpec
    ? { page_id: input.pageId }
    : {
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
    spec[input.instagramField ?? "instagram_user_id"] = input.instagramAccountId;
  }

  // Both of these alter the pixels Meta serves: one reframes the image per
  // placement, the other animates it. Neither is safe over designed-in copy,
  // so an image carrying its own headline opts out of both and is delivered
  // as authored — fitted to the placement rather than cropped into it.
  const enroll = input.adaptToPlacement ? "OPT_IN" : "OPT_OUT";

  const form = new URLSearchParams({
    name: input.name,
    object_story_spec: JSON.stringify(spec),
    url_tags: input.urlTags,
  });

  if (input.assetFeedSpec) {
    form.set("asset_feed_spec", JSON.stringify(input.assetFeedSpec));
    // No degrees_of_freedom_spec alongside it. Both fields tell Meta how it
    // may vary the creative per placement, and the asset feed already answers
    // that completely: this image here, that image there. Sending the two
    // together is a contradiction, and the failure it produces is generic.
  } else {
    form.set(
      "degrees_of_freedom_spec",
      JSON.stringify({
        creative_features_spec: {
          adapt_to_placement: { enroll_status: enroll },
          media_liquidity_animated_image: { enroll_status: enroll },
        },
      }),
    );
  }

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
  business?: string | null,
): Promise<string | null> {
  const body = await request<Paged<{ body?: string }>>(
    url(`${adAccountId}/generatepreviews`, {
      creative: JSON.stringify(creativeSpec),
      ad_format: format,
    }),
    { business },
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

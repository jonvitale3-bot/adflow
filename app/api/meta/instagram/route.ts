import { NextResponse } from "next/server";

import {
  createPageBackedInstagramAccount,
  listInstagramAccounts,
  MetaApiError,
} from "@/lib/meta/client";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const url = new URL(request.url);
  const adAccountId = url.searchParams.get("adAccountId");
  const pageId = url.searchParams.get("pageId") ?? undefined;
  const business = url.searchParams.get("business");

  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }

  try {
    // pageId is threaded through, unlike the old build where it was never
    // sent and two of three discovery endpoints were dead in practice.
    //
    // The attempts come back too. Four endpoints are merged, so an empty list
    // could mean the client genuinely has no Instagram identity or that every
    // request failed, and those need different fixes.
    const { accounts, attempts } = await listInstagramAccounts(adAccountId, pageId, business);
    return NextResponse.json({ accounts, attempts });
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : "Could not load Instagram accounts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Creates a Page-backed Instagram account for a client that has none.
 *
 * Only reachable by asking for it. It writes to the client's Facebook Page,
 * and while Meta would create the same object by itself the first time an ad
 * needed it, doing that to someone's Page without being asked is not this
 * app's call to make.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const pageId = typeof body?.pageId === "string" ? body.pageId : null;
  const business = typeof body?.business === "string" ? body.business : null;

  if (!pageId) return NextResponse.json({ error: "pageId is required" }, { status: 400 });

  try {
    const account = await createPageBackedInstagramAccount(pageId, business);
    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof MetaApiError ? err.message : "Could not create the account";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

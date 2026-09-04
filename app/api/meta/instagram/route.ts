import { NextResponse } from "next/server";

import { listInstagramAccounts, MetaApiError } from "@/lib/meta/client";
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
    const accounts = await listInstagramAccounts(adAccountId, pageId, business);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : "Could not load Instagram accounts";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

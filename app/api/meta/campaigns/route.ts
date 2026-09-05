import { NextResponse } from "next/server";

import { cached } from "@/lib/meta/cache";
import { listCampaigns, MetaApiError } from "@/lib/meta/client";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const adAccountId = params.get("adAccountId");
  const business = params.get("business");
  const refresh = params.get("refresh") === "1";
  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }

  try {
    const campaigns = await cached(
      `campaigns:${business ?? ""}:${adAccountId}`,
      () => listCampaigns(adAccountId, business),
      { ttlMs: 5 * 60_000, refresh },
    );
    return NextResponse.json({ campaigns });
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : "Could not load campaigns";
    const retryable = err instanceof MetaApiError && err.isRateLimit;
    return NextResponse.json({ error: message, retryable }, { status: retryable ? 429 : 502 });
  }
}

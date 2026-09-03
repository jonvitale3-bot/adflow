import { NextResponse } from "next/server";

import { listCampaigns, MetaApiError } from "@/lib/meta/client";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const adAccountId = new URL(request.url).searchParams.get("adAccountId");
  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId is required" }, { status: 400 });
  }

  try {
    const campaigns = await listCampaigns(adAccountId);
    return NextResponse.json({ campaigns });
  } catch (err) {
    const message = err instanceof MetaApiError ? err.message : "Could not load campaigns";
    const retryable = err instanceof MetaApiError && err.isRateLimit;
    return NextResponse.json({ error: message, retryable }, { status: retryable ? 429 : 502 });
  }
}

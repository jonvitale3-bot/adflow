import { NextResponse } from "next/server";

import { cached } from "@/lib/meta/cache";
import { listAdSets, MetaApiError } from "@/lib/meta/client";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const campaignId = params.get("campaignId");
  const business = params.get("business");
  const refresh = params.get("refresh") === "1";
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  try {
    // This is the lookup Meta rate limits hardest, and the one most often
    // asked for the same campaign twice in a minute.
    const adSets = await cached(
      `adsets:${business ?? ""}:${campaignId}`,
      () => listAdSets(campaignId, business),
      { ttlMs: 5 * 60_000, refresh },
    );
    return NextResponse.json({ adSets });
  } catch (err) {
    // Meta rate-limits ad set listing routinely (error 613). Say so plainly
    // rather than reporting a generic failure — the fix is to wait.
    const rateLimited = err instanceof MetaApiError && err.isRateLimit;
    return NextResponse.json(
      {
        error: rateLimited
          ? "Meta is rate limiting ad set lookups. Wait about a minute and try again."
          : err instanceof MetaApiError
            ? err.message
            : "Could not load ad sets",
        retryable: rateLimited,
      },
      { status: rateLimited ? 429 : 502 },
    );
  }
}

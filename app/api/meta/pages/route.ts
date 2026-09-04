import { NextResponse } from "next/server";

import { listPages, MetaApiError } from "@/lib/meta/client";
import { createClient } from "@/lib/supabase/server";

/**
 * The Pages a portfolio's token can act for.
 *
 * A Page here means the token can actually create ads as it, which is what
 * matters: an ad creative posts as a Page, so a Page the token cannot see is a
 * Page the push will fail on.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const business = new URL(request.url).searchParams.get("business");

  try {
    const pages = await listPages(business);
    return NextResponse.json({
      pages: pages
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    const message =
      err instanceof MetaApiError
        ? err.isAuthError
          ? "This portfolio's token was rejected by Meta."
          : err.message
        : "Could not load Pages";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { listAdAccounts, listPages, MetaApiError } from "@/lib/meta/client";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Verifies the Meta connection and reports what the system-user token can
 * actually see, so a client can be matched to an account without leaving the
 * app. Never returns the token itself.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!env.META_ACCESS_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "META_ACCESS_TOKEN is not set in this environment." },
      { status: 400 },
    );
  }

  try {
    const [adAccounts, pages] = await Promise.all([listAdAccounts(), listPages()]);
    return NextResponse.json({
      ok: true,
      adAccounts: adAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        business: a.business?.name ?? null,
        // 1 is active; anything else means the account cannot deliver.
        active: a.account_status === 1,
      })),
      pages: pages.map((p) => ({ id: p.id, name: p.name })),
    });
  } catch (err) {
    const isAuth = err instanceof MetaApiError && err.isAuthError;
    return NextResponse.json(
      {
        ok: false,
        error: isAuth
          ? "Meta rejected the token. It may have expired or been revoked — generate a new system-user token and update META_ACCESS_TOKEN in Vercel."
          : err instanceof Error
            ? err.message
            : "Could not reach Meta",
      },
      { status: 502 },
    );
  }
}

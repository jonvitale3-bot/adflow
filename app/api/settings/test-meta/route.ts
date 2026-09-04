import { NextResponse } from "next/server";

import { businessLabel } from "@/lib/meta/business-keys";
import { listAdAccounts, listPages, MetaApiError } from "@/lib/meta/client";
import { configuredBusinesses } from "@/lib/meta/tokens";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Checks every configured business portfolio and reports what each token can
 * actually see. Never returns a token.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const businesses = configuredBusinesses();
  if (businesses.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No Meta token is set. Add META_ACCESS_TOKEN in Vercel and redeploy." },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    businesses.map(async ({ key, envName }) => {
      try {
        const [adAccounts, pages] = await Promise.all([listAdAccounts(key), listPages(key)]);
        return {
          key,
          label: businessLabel(key),
          envName,
          ok: true,
          adAccounts: adAccounts.map((a) => ({
            id: a.id,
            name: a.name,
            business: a.business?.name ?? null,
            active: a.account_status === 1,
          })),
          pageCount: pages.length,
        };
      } catch (err) {
        const isAuth = err instanceof MetaApiError && err.isAuthError;
        return {
          key,
          label: businessLabel(key),
          envName,
          ok: false,
          error: isAuth
            ? `Meta rejected this token. Generate a new system-user token and update ${envName} in Vercel.`
            : err instanceof Error
              ? err.message
              : "Could not reach Meta",
        };
      }
    }),
  );

  return NextResponse.json({ ok: results.some((r) => r.ok), businesses: results });
}

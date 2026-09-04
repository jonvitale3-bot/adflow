import { NextResponse } from "next/server";

import { businessLabel } from "@/lib/meta/business-keys";
import { configuredBusinesses } from "@/lib/meta/tokens";
import { createClient } from "@/lib/supabase/server";

/** Names only — never a token value. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({
    businesses: configuredBusinesses().map(({ key }) => ({ key, label: businessLabel(key) })),
  });
}

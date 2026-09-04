import { NextResponse } from "next/server";

import {
  cachedLabel,
  labelFrom,
  pickBusinessName,
  rememberBusinessName,
} from "@/lib/meta/business-names";
import { listAdAccounts } from "@/lib/meta/client";
import { configuredBusinesses } from "@/lib/meta/tokens";
import { createClient } from "@/lib/supabase/server";

/** Names only — never a token value. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Named as Meta names them, so the picker reads like Business Manager does.
  const businesses = await Promise.all(
    configuredBusinesses().map(async ({ key }) => {
      const known = cachedLabel(key);
      if (known) return { key, label: known };

      let name: string | null = null;
      try {
        name = pickBusinessName(await listAdAccounts(key));
      } catch {
        // A token that cannot be reached or was rejected surfaces on the
        // settings screen, which tests each one and says which. Here it only
        // means a plainer label — never a failed request.
      }
      rememberBusinessName(key, name);
      return { key, label: labelFrom(key, name) };
    }),
  );

  return NextResponse.json({ businesses });
}

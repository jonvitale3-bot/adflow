import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { cached } from "@/lib/meta/cache";
import { getAdAccountTimezone } from "@/lib/meta/client";

import { DEFAULT_TIMEZONE, isValidTimeZone, timeZoneFromAdAccount } from "./timezone.ts";

interface ClientClock {
  id: string;
  timezone?: string | null;
  meta_ad_account_id?: string | null;
  meta_business?: string | null;
}

/**
 * The client's zone, filling it in from Meta the first time it is needed.
 *
 * Nobody types this: a client with an ad account gets the account's zone, and
 * it is written back so the form shows it and the next call is free. A client
 * with neither gets the default, which is what everyone got before.
 */
export async function resolveClientTimezone(
  db: SupabaseClient,
  client: ClientClock,
): Promise<string> {
  if (isValidTimeZone(client.timezone)) return client.timezone;

  if (client.meta_ad_account_id) {
    try {
      const fromMeta = await cached(
        `timezone:${client.meta_ad_account_id}`,
        () => getAdAccountTimezone(client.meta_ad_account_id!, client.meta_business),
        { ttlMs: 24 * 60 * 60_000 },
      );
      const zone = timeZoneFromAdAccount(fromMeta);
      if (zone) {
        await db.from("clients").update({ timezone: zone }).eq("id", client.id);
        return zone;
      }
    } catch {
      // Meta being unreachable is not a reason to fail a launch; the default
      // is what every client used until today.
    }
  }

  return DEFAULT_TIMEZONE;
}

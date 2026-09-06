import { ClientsView } from "@/components/clients/clients-view";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/clients/grouping";
import { tallyStats } from "@/lib/clients/stats";

export default async function ClientsPage() {
  const supabase = await createClient();

  const [{ data, error }, { data: creatives }, { data: drafts }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, brand, location_label, industry, market_name, location_description, landing_page_url, meta_ad_account_id, special_ad_category",
      )
      .eq("archived", false)
      .order("name"),
    supabase.from("creatives").select("client_id").eq("archived", false),
    supabase.from("ad_variations").select("client_id").eq("status", "draft"),
  ]);

  return (
    <ClientsView
      clients={(data ?? []) as ClientRow[]}
      stats={tallyStats(creatives ?? [], drafts ?? [])}
      loadError={error?.message ?? null}
    />
  );
}

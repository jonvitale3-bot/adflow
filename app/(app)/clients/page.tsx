import { ClientsView } from "@/components/clients/clients-view";
import { createClient } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/clients/grouping";

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, name, brand, location_label, industry, market_name, location_description, landing_page_url, meta_ad_account_id",
    )
    .eq("archived", false)
    .order("name");

  return <ClientsView clients={(data ?? []) as ClientRow[]} loadError={error?.message ?? null} />;
}

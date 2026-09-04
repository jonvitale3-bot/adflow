import { LaunchView } from "@/components/launch/launch-view";
import { createClient } from "@/lib/supabase/server";

export default async function LaunchPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select(
      "id, name, industry, marine_business_type, meta_ad_account_id, meta_page_id, meta_business, landing_page_url, location_description, market_name, season_type, current_promotion, business_type_description, offer_description, tone_keywords",
    )
    .eq("archived", false)
    .order("name");

  const { data: defaults } = await supabase
    .from("client_launch_defaults")
    .select("client_id, meta_campaign_id, meta_adset_id, instagram_account_id, default_batch_size");

  return <LaunchView clients={clients ?? []} defaults={defaults ?? []} />;
}

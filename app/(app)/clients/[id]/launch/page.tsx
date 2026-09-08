import { notFound } from "next/navigation";

import { LaunchView } from "@/components/launch/launch-view";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Launch" };

export default async function ClientLaunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: defaults }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, name, industry, marine_business_type, meta_ad_account_id, meta_page_id, meta_business, landing_page_url, location_description, market_name, season_type, current_promotion, business_type_description, offer_description, tone_keywords",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("client_launch_defaults")
      .select("client_id, meta_campaign_id, meta_adset_id, instagram_account_id, default_batch_size")
      .eq("client_id", id)
      .maybeSingle(),
  ]);

  if (!client) notFound();

  return <LaunchView client={client} defaults={defaults} />;
}

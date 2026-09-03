import { CreativesView } from "@/components/creatives/creatives-view";
import { createClient } from "@/lib/supabase/server";

export default async function CreativesPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, meta_ad_account_id")
    .eq("archived", false)
    .order("name");

  return <CreativesView clients={clients ?? []} />;
}

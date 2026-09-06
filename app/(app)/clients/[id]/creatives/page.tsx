import { notFound } from "next/navigation";

import { CreativesView } from "@/components/creatives/creatives-view";
import { createClient } from "@/lib/supabase/server";

export default async function ClientCreativesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, meta_ad_account_id, industry, marine_business_types")
    .eq("id", id)
    .maybeSingle();

  if (!client) notFound();

  return <CreativesView client={client} />;
}

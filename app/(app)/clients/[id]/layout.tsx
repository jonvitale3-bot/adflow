import { notFound } from "next/navigation";

import { ClientHeader } from "@/components/clients/client-header";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything under /clients/[id] is one client's workspace. The header names
 * the client, offers the two steps, and has a switcher so moving to another
 * client is a keystroke rather than a trip back to the list.
 */
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: clients }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, location_label, market_name, location_description, archived")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("clients").select("id, name").eq("archived", false).order("name"),
  ]);

  if (!client) notFound();

  return (
    <>
      <ClientHeader client={client} clients={clients ?? []} />
      {children}
    </>
  );
}

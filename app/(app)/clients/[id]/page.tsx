import { redirect } from "next/navigation";

import { clientPath } from "@/lib/clients/paths";

/** A client's front door is Launch: that is the job. Creatives is one tab over. */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(clientPath(id, "launch"));
}

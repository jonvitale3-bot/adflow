import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { clientPath, isUuid, LAST_CLIENT_COOKIE } from "@/lib/clients/paths";
import { createClient } from "@/lib/supabase/server";

/**
 * Opens the client last worked on, or the list when there is none yet. This
 * used to render every client's launch behind a dropdown that always
 * started at whoever sorted first.
 */
export default async function LaunchPage() {
  const remembered = (await cookies()).get(LAST_CLIENT_COOKIE)?.value;

  if (isUuid(remembered)) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("id", remembered)
      .eq("archived", false)
      .maybeSingle();
    if (data) redirect(clientPath(data.id, "launch"));
  }

  redirect("/clients");
}

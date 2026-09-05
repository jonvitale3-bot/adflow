import { SettingsView } from "@/components/settings/settings-view";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [clients, creatives, variations] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("archived", false),
    supabase.from("creatives").select("id", { count: "exact", head: true }).eq("archived", false),
    supabase.from("ad_variations").select("id", { count: "exact", head: true }),
  ]);

  // Only whether a credential is configured ever crosses to the browser —
  // never the value. That is the whole point of lib/env.ts being server-only.
  return (
    <SettingsView
      email={user?.email ?? ""}
      configured={{
        meta: Boolean(env.META_ACCESS_TOKEN),
        anthropic: Boolean(env.ANTHROPIC_API_KEY),
        openai: Boolean(env.OPENAI_API_KEY),
      }}
      graphVersion={env.META_GRAPH_VERSION}
      counts={{
        clients: clients.count ?? 0,
        creatives: creatives.count ?? 0,
        variations: variations.count ?? 0,
      }}
    />
  );
}

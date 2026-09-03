import { redirect } from "next/navigation";

import { Sidebar } from "@/components/shell/sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects, but a layout that renders data must not
  // depend on middleware alone having run.
  if (!user) redirect("/login");

  const [clients, creatives] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("archived", false),
    supabase.from("creatives").select("id", { count: "exact", head: true }).eq("archived", false),
  ]);

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        email={user.email ?? ""}
        counts={{ clients: clients.count ?? 0, creatives: creatives.count ?? 0 }}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

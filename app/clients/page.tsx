import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">Clients</h1>
      <p className="mt-1 text-sm text-muted">
        Signed in as {user?.email}
      </p>

      <div className="mt-8 rounded-card border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted">
          Phase 1 migrates the schema. Client records land here next.
        </p>
      </div>
    </main>
  );
}

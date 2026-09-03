import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id, kind, status, total_items, completed_items, failed_items, error")
    .eq("id", id)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const { data: items } = await supabase
    .from("job_items")
    .select("id, variation_id, status, attempts, error")
    .eq("job_id", id);

  return NextResponse.json({ job, items: items ?? [] });
}

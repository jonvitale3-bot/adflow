import { NextResponse } from "next/server";

import { runJobSlice } from "@/lib/launch/runner";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

/**
 * Processes a slice of a job. The client calls this repeatedly until
 * `remaining` reaches zero, so a function timeout costs one slice rather than
 * the whole run.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const result = await runJobSlice(supabase, id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    await supabase
      .from("jobs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

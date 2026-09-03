import { NextResponse } from "next/server";

import { ClientFormSchema, fieldErrors } from "@/lib/clients/validation";
import { splitBrand } from "@/lib/clients/grouping";
import { createClient } from "@/lib/supabase/server";

/** Empty strings become null so the database holds absence, not "". */
function normalize(values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = ClientFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Some fields need attention", fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  // Brand and location are derived once at write time rather than re-split on
  // every render, and stay editable afterwards.
  const { brand, location } = splitBrand(parsed.data.name);

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...normalize(parsed.data), brand, location_label: location })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

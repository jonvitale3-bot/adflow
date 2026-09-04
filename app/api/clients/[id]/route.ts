import { NextResponse } from "next/server";

import { ClientFormSchema, fieldErrors } from "@/lib/clients/validation";
import { splitBrand } from "@/lib/clients/grouping";
import { createClient } from "@/lib/supabase/server";

function normalize(values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  }
  // The scalar column carries the primary service, so existing reads and the
  // prompt template keep working while the array holds the full set.
  const services = values.marine_business_types as string[] | undefined;
  out.marine_business_type = services?.[0] ?? null;
  return out;
}

/** The full record. The list only selects the columns it renders, so the edit
 *  panel must load the rest or a save would write nulls over them. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json({ client: data });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { brand, location } = splitBrand(parsed.data.name);

  const { error } = await supabase
    .from("clients")
    .update({ ...normalize(parsed.data), brand, location_label: location })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Archive rather than delete. Creatives and variations cascade from a client
  // row, so a real delete would silently destroy generated work.
  const { error } = await supabase.from("clients").update({ archived: true }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

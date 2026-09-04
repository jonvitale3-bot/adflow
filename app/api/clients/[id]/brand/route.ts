import { NextResponse } from "next/server";
import { z } from "zod";

import { scrapeBrandVoice } from "@/lib/generation/brand-voice";
import { createClient } from "@/lib/supabase/server";

// Fetching several pages and inferring a voice runs well past the default.
export const maxDuration = 120;

const SaveSchema = z.object({
  brand_website_url: z.string().trim().default(""),
  brand_voice: z.string().trim().default(""),
  key_phrases: z.string().trim().default(""),
  never_say: z.string().trim().default(""),
  ad_examples: z.string().trim().default(""),
});

const ScrapeSchema = z.object({ url: z.string().trim().min(1) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data } = await supabase
    .from("client_brand_settings")
    .select("brand_website_url, brand_voice, key_phrases, never_say, ad_examples")
    .eq("client_id", id)
    .maybeSingle();

  return NextResponse.json({ brand: data ?? null });
}

/** Saves the brand settings for one client. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = SaveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const values = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]),
  );

  const { error } = await supabase
    .from("client_brand_settings")
    .upsert({ client_id: id, ...values }, { onConflict: "client_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/**
 * Reads the client's own site and infers its voice. Returns the result for
 * review rather than saving it: these rules feed every ad this client runs, so
 * they get looked at before they take effect.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = ScrapeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A website URL is required" }, { status: 400 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id, industry, special_ad_category")
    .eq("id", id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Accept a bare domain; the operator rarely types the scheme.
  const raw = parsed.data.url;
  const url = raw.startsWith("http") ? raw : `https://${raw}`;

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: `"${raw}" is not a valid URL.` }, { status: 400 });
  }

  try {
    const brand = await scrapeBrandVoice(url, {
      industry: client.industry,
      specialAdCategory: client.special_ad_category,
    });
    return NextResponse.json({ brand, url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not analyse that site" },
      { status: 502 },
    );
  }
}

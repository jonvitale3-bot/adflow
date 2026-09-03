import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";

const optional = () =>
  z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  META_ACCESS_TOKEN: optional(),
  ANTHROPIC_API_KEY: optional(),
  META_GRAPH_VERSION: z.preprocess(
    (v) => (v === "" || v === undefined ? "v21.0" : v),
    z.string(),
  ),
});

test("empty optional vars (what Vercel sends) parse fine", () => {
  const r = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
    SUPABASE_SERVICE_ROLE_KEY: "s",
    META_ACCESS_TOKEN: "",
    ANTHROPIC_API_KEY: "",
    META_GRAPH_VERSION: "",
  });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.META_ACCESS_TOKEN, undefined);
    assert.equal(r.data.META_GRAPH_VERSION, "v21.0");
  }
});

test("missing required vars still fail loudly", () => {
  const r = schema.safeParse({ NEXT_PUBLIC_SUPABASE_URL: "" });
  assert.equal(r.success, false);
});

test("a real value still comes through", () => {
  const r = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
    SUPABASE_SERVICE_ROLE_KEY: "s",
    META_ACCESS_TOKEN: "tok",
  });
  assert.equal(r.success && r.data.META_ACCESS_TOKEN, "tok");
});

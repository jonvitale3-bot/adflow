import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Importing this from a client component is a build
 * error, which is the point: in the Lovable build every credential lived in a
 * queryable `app_settings` table and one unauthenticated edge function could
 * read all of them (docs/SPEC.md §8). Secrets now exist only here.
 */
/**
 * Treat an empty string as unset.
 *
 * Vercel pre-populates every variable it finds in .env.example, so an
 * unconfigured optional key arrives as "" rather than undefined. Without this,
 * importing the repo and deploying fails the build on variables that are not
 * needed until a later phase.
 */
const optional = () =>
  z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("must be a full https:// URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "is required"),

  // Optional until Phase 3/4 wires up generation and push, so the app deploys
  // and runs with only Supabase configured.
  META_ACCESS_TOKEN: optional(),
  META_APP_ID: optional(),
  META_APP_SECRET: optional(),
  META_GRAPH_VERSION: z.preprocess(
    (v) => (v === "" || v === undefined ? "v21.0" : v),
    z.string(),
  ),

  ANTHROPIC_API_KEY: optional(),
  OPENAI_API_KEY: optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment:\n${missing}\n\nSee .env.example`);
}

export const env = parsed.data;

/** Throw a useful error at the call site rather than sending `undefined` to an API. */
export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === "") {
    throw new Error(`${key} is not set. See .env.example`);
  }
  return value as NonNullable<(typeof env)[K]>;
}

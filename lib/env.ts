import "server-only";
import { z } from "zod";

/**
 * Server-only environment. Importing this from a client component is a build
 * error, which is the point: in the Lovable build every credential lived in a
 * queryable `app_settings` table and one unauthenticated edge function could
 * read all of them (docs/SPEC.md §8). Secrets now exist only here.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Optional until Phase 3/4 wires up generation and push, so a fresh clone
  // boots with only Supabase configured.
  META_ACCESS_TOKEN: z.string().min(1).optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v21.0"),

  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
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

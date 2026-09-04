import "server-only";

import { DEFAULT_BUSINESS_KEY, envNameFor, isValidBusinessKey } from "./business-keys.ts";

/**
 * Multiple Meta business portfolios.
 *
 * One system-user token cannot see across Business Managers, and the client
 * roster spans more than one. So there are several tokens — but they stay in
 * the environment. A client row records only WHICH token to use, never the
 * token itself. Putting credentials in a queryable table is the exact defect
 * this rebuild exists to remove (docs/SPEC.md §8).
 *
 * Env shape:
 *   META_ACCESS_TOKEN                  the default portfolio
 *   META_ACCESS_TOKEN_<KEY>            an additional portfolio
 *
 * A client's `meta_business` column holds <KEY> (lowercased), or null for the
 * default.
 */

export { DEFAULT_BUSINESS_KEY, isValidBusinessKey };

/**
 * Every portfolio configured in this environment, discovered by scanning for
 * the env prefix — so adding a portfolio is one Vercel variable and a redeploy,
 * with no code change.
 */
export function configuredBusinesses(): Array<{ key: string; envName: string }> {
  const out: Array<{ key: string; envName: string }> = [];

  if (process.env.META_ACCESS_TOKEN) {
    out.push({ key: DEFAULT_BUSINESS_KEY, envName: "META_ACCESS_TOKEN" });
  }

  for (const name of Object.keys(process.env)) {
    const match = /^META_ACCESS_TOKEN_(.+)$/.exec(name);
    if (!match || !process.env[name]) continue;
    const key = match[1]!.toLowerCase();
    // Guard against the optional debugging vars sharing the prefix.
    if (key === "" || out.some((b) => b.key === key)) continue;
    out.push({ key, envName: name });
  }

  return out.sort((a, b) =>
    a.key === DEFAULT_BUSINESS_KEY ? -1 : b.key === DEFAULT_BUSINESS_KEY ? 1 : a.key.localeCompare(b.key),
  );
}

/**
 * Resolves the token for a client's portfolio. Throws with an actionable
 * message rather than silently falling back to the default token — using the
 * wrong portfolio's token would create ads in the wrong business.
 */
export function tokenForBusiness(businessKey: string | null | undefined): string {
  const key = businessKey?.trim().toLowerCase() || DEFAULT_BUSINESS_KEY;
  const envName = envNameFor(key);
  const token = process.env[envName];

  if (!token) {
    throw new Error(
      key === DEFAULT_BUSINESS_KEY
        ? "META_ACCESS_TOKEN is not set in this environment."
        : `This client is assigned to the "${key}" business portfolio, but ${envName} is not set. Add it in Vercel and redeploy.`,
    );
  }

  return token;
}

import { businessLabel } from "./business-keys.ts";
import type { AdAccount } from "./client.ts";

/**
 * What to call each portfolio in the UI.
 *
 * A portfolio key is an environment-variable suffix — "default", "salesoptima" —
 * which is fine for config and wrong on screen. Meta already knows the real
 * name of the Business Manager each token belongs to, so the label comes from
 * there and nothing has to be typed twice or kept in sync by hand.
 *
 * Deliberately free of Graph calls: callers that already hold the ad accounts
 * name the portfolio from those, and the one caller that does not fetches them
 * itself. That also keeps this testable without a token.
 */

// A name change in Business Manager is rare; a stale label for a few minutes
// costs nothing, and a Graph round trip on every panel open costs latency.
const TTL_MS = 10 * 60_000;

const cache = new Map<string, { name: string | null; at: number }>();

/**
 * The Business Manager these accounts live in.
 *
 * A token normally sees one portfolio's accounts, but a partner-shared account
 * can belong to another business, so the most common name wins rather than
 * whichever happens to sort first.
 */
export function pickBusinessName(accounts: Pick<AdAccount, "business">[]): string | null {
  const counts = new Map<string, number>();
  for (const account of accounts) {
    const name = account.business?.name?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;
  // Alphabetical on a tie, so the label does not flip between requests.
  for (const [name, count] of [...counts].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }

  return best;
}

/** Records a name, so the settings check warms the picker in the client panel. */
export function rememberBusinessName(key: string, name: string | null): void {
  cache.set(key, { name, at: Date.now() });
}

/** The remembered label, or null when nothing fresh is known for this key. */
export function cachedLabel(key: string): string | null {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at >= TTL_MS) return null;
  return hit.name ?? businessLabel(key);
}

/** Meta's name for the portfolio, or the plainer key-derived one. */
export function labelFrom(key: string, name: string | null): string {
  return name ?? businessLabel(key);
}

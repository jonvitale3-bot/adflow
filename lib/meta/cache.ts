import "server-only";

/**
 * A short memory for Meta lookups.
 *
 * Campaigns, ad sets, Pages and Instagram identities are read on every visit
 * to the launch screen and on every change of client, and they answer the same
 * way for hours at a time. Asking again each time is how a day of ordinary
 * testing ends in "There have been too many calls from this ad-account", which
 * then blocks the launch itself rather than merely the lookup.
 *
 * Deliberately small in scope:
 *
 * - Per process, so it disappears with the instance. Nothing here is worth a
 *   shared store, and a stale campaign list that outlives a deploy would be
 *   worse than a slow one.
 * - Successes only. A rate-limited response cached for five minutes would
 *   extend the outage rather than soften it, which is the opposite of the job.
 * - Single-flight, because the duplicate calls are as much of the problem as
 *   the repeats: a client switched twice in a second fires the same lookup
 *   twice, and React runs effects twice in development.
 */

interface Entry {
  value: unknown;
  expires: number;
}

/** Bounded, so a long-lived instance cannot accumulate every client's lookups. */
const MAX_ENTRIES = 300;

const store = new Map<string, Entry>();
const inFlight = new Map<string, Promise<unknown>>();

export interface CacheOptions {
  ttlMs: number;
  /** Skips the stored value, still sharing one request with any in flight. */
  refresh?: boolean;
  /** Injected by tests; production has no reason to pass a clock. */
  now?: () => number;
}

function evict(now: number): void {
  if (store.size <= MAX_ENTRIES) return;

  for (const [key, entry] of store) {
    if (entry.expires <= now) store.delete(key);
  }

  // Still full, so drop oldest first: Map iterates in insertion order.
  for (const key of store.keys()) {
    if (store.size <= MAX_ENTRIES) break;
    store.delete(key);
  }
}

export async function cached<T>(
  key: string,
  load: () => Promise<T>,
  { ttlMs, refresh = false, now = Date.now }: CacheOptions,
): Promise<T> {
  const at = now();

  if (!refresh) {
    const hit = store.get(key);
    if (hit && hit.expires > at) return hit.value as T;
  }

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      // Only a success is remembered. An error is a fact about this moment.
      store.set(key, { value, expires: now() + ttlMs });
      evict(now());
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

/** Test seam. Nothing in the app clears the cache; it expires on its own. */
export function resetCache(): void {
  store.clear();
  inFlight.clear();
}

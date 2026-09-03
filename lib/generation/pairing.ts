/**
 * Round-robin pairing of variations to creatives.
 *
 * Ported from the old build, with one fix: creatives are ordered explicitly.
 * The original relied on whatever order Postgres returned with no ORDER BY,
 * so the same inputs produced different pairings run to run
 * (docs/SPEC.md §7). Archived creatives are excluded, as before.
 */
export function pairWithCreatives<T extends { id: string; created_at: string }>(
  count: number,
  creatives: T[],
): Array<string | null> {
  if (creatives.length === 0) return Array.from({ length: count }, () => null);

  const ordered = [...creatives].sort((a, b) =>
    a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
  );

  return Array.from({ length: count }, (_, i) => ordered[i % ordered.length]!.id);
}

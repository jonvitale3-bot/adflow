/**
 * What each client has waiting, for the list.
 *
 * The list is the front door now, so a row should say whether there is
 * anything to do behind it: no creatives means Launch is a dead end, drafts
 * mean a batch is sitting there unpushed.
 */
export interface ClientStats {
  creatives: number;
  drafts: number;
}

export const NO_WORK: ClientStats = { creatives: 0, drafts: 0 };

export function tallyStats(
  creatives: Array<{ client_id: string }>,
  drafts: Array<{ client_id: string }>,
): Record<string, ClientStats> {
  const out: Record<string, ClientStats> = {};
  const at = (id: string) => (out[id] ??= { creatives: 0, drafts: 0 });
  for (const row of creatives) at(row.client_id).creatives += 1;
  for (const row of drafts) at(row.client_id).drafts += 1;
  return out;
}

export function sumStats(ids: string[], stats: Record<string, ClientStats>): ClientStats {
  return ids.reduce(
    (acc, id) => {
      const s = stats[id] ?? NO_WORK;
      return { creatives: acc.creatives + s.creatives, drafts: acc.drafts + s.drafts };
    },
    { ...NO_WORK },
  );
}

/**
 * Brand grouping for the clients list.
 *
 * Client names encode a hierarchy: "Carefree Boat Club - South Florida" is
 * brand + location, separated by a whitespace-padded hyphen, en-dash or
 * em-dash (docs/SPEC.md §9 rule 1). "Brand-Location" without spaces is NOT a
 * separator and must stay a single name.
 *
 * The schema now stores `brand` and `location_label` explicitly; this splitter
 * is the fallback for rows that lack them, and the suggestion offered when
 * creating a client.
 */

const SEPARATOR = /\s+[-–—]\s+/;

export interface ClientRow {
  id: string;
  name: string;
  brand: string | null;
  location_label: string | null;
  industry: string;
  market_name: string | null;
  location_description: string | null;
  landing_page_url: string | null;
  meta_ad_account_id: string | null;
  special_ad_category?: string;
}

export function splitBrand(name: string): { brand: string; location: string | null } {
  const parts = name.split(SEPARATOR);
  if (parts.length < 2) return { brand: name.trim(), location: null };
  const [brand, ...rest] = parts;
  return { brand: brand!.trim(), location: rest.join(" - ").trim() || null };
}

export function brandOf(client: ClientRow): string {
  return client.brand?.trim() || splitBrand(client.name).brand;
}

export function locationOf(client: ClientRow): string | null {
  return client.location_label?.trim() || splitBrand(client.name).location;
}

export type AdAccountState = "connected" | "missing";

export function adAccountState(client: ClientRow): AdAccountState {
  return client.meta_ad_account_id ? "connected" : "missing";
}

export interface BrandGroup {
  kind: "group";
  brand: string;
  clients: ClientRow[];
  connectedCount: number;
  industries: string[];
}

export interface SingleClient {
  kind: "single";
  client: ClientRow;
}

export type ListEntry = BrandGroup | SingleClient;

/**
 * Groups clients by brand. A brand with exactly one client renders as a plain
 * row, not a group of one.
 */
export function groupByBrand(clients: ClientRow[]): ListEntry[] {
  const byBrand = new Map<string, ClientRow[]>();

  for (const client of clients) {
    const brand = brandOf(client);
    const existing = byBrand.get(brand);
    if (existing) existing.push(client);
    else byBrand.set(brand, [client]);
  }

  const entries: ListEntry[] = [];
  for (const [brand, members] of byBrand) {
    if (members.length === 1) {
      entries.push({ kind: "single", client: members[0]! });
      continue;
    }
    entries.push({
      kind: "group",
      brand,
      clients: members,
      connectedCount: members.filter((c) => adAccountState(c) === "connected").length,
      industries: [...new Set(members.map((c) => c.industry))],
    });
  }

  // Alphabetical by display name, so the list is stable between renders.
  return entries.sort((a, b) => {
    const an = a.kind === "group" ? a.brand : a.client.name;
    const bn = b.kind === "group" ? b.brand : b.client.name;
    return an.localeCompare(bn);
  });
}

/** Search matches name, location description, market and landing page URL. */
export function matchesSearch(client: ClientRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [client.name, client.location_description, client.landing_page_url, client.market_name]
    .some((field) => field?.toLowerCase().includes(q));
}

export function filterClients(
  clients: ClientRow[],
  { query, industry }: { query: string; industry: string },
): ClientRow[] {
  return clients.filter(
    (c) => matchesSearch(c, query) && (industry === "all" || c.industry === industry),
  );
}

export const INDUSTRY_LABELS: Record<string, string> = {
  boat_club: "Boat Club",
  marina: "Marina",
  med_spa: "Med Spa",
  fitness: "Fitness",
  real_estate: "Real Estate",
  home_services: "Home Services",
  finance: "Finance",
  insurance: "Insurance",
  legal: "Legal",
  automotive: "Automotive",
  hospitality: "Hospitality",
  other: "Other",
};

export function industryLabel(value: string): string {
  return INDUSTRY_LABELS[value] ?? value;
}

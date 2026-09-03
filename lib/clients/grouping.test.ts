import assert from "node:assert/strict";
import { test } from "node:test";

import {
  brandOf,
  filterClients,
  groupByBrand,
  locationOf,
  splitBrand,
  type ClientRow,
} from "./grouping.ts";

function c(over: Partial<ClientRow> & { name: string }): ClientRow {
  return {
    id: over.name,
    brand: null,
    location_label: null,
    industry: "boat_club",
    market_name: null,
    location_description: null,
    landing_page_url: null,
    meta_ad_account_id: "act_1",
    ...over,
  };
}

test("splits on a whitespace-padded hyphen, en-dash or em-dash", () => {
  for (const sep of ["-", "–", "—"]) {
    const r = splitBrand(`Carefree Boat Club ${sep} South Florida`);
    assert.equal(r.brand, "Carefree Boat Club");
    assert.equal(r.location, "South Florida");
  }
});

test("an unspaced hyphen is NOT a separator", () => {
  // "Brand-Location" must stay one name (docs/SPEC.md §9 rule 1). A real
  // hyphenated company name would otherwise be split in half.
  const r = splitBrand("Jones-Smith Insurance");
  assert.equal(r.brand, "Jones-Smith Insurance");
  assert.equal(r.location, null);
});

test("a name with no separator has no location", () => {
  assert.deepEqual(splitBrand("Glow Med Spa"), { brand: "Glow Med Spa", location: null });
});

test("explicit brand and location columns win over the splitter", () => {
  const row = c({ name: "Anything At All", brand: "Real Brand", location_label: "Real Place" });
  assert.equal(brandOf(row), "Real Brand");
  assert.equal(locationOf(row), "Real Place");
});

test("a brand with one client is a plain row, not a group of one", () => {
  const entries = groupByBrand([c({ name: "Glow Med Spa" })]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.kind, "single");
});

test("a brand with several clients groups, and counts connections", () => {
  const entries = groupByBrand([
    c({ name: "Carefree Boat Club - Lake Norman" }),
    c({ name: "Carefree Boat Club - Clearwater" }),
    c({ name: "Carefree Boat Club - Lake Travis", meta_ad_account_id: null }),
  ]);
  assert.equal(entries.length, 1);
  const group = entries[0]!;
  assert.equal(group.kind, "group");
  if (group.kind !== "group") return;
  assert.equal(group.brand, "Carefree Boat Club");
  assert.equal(group.clients.length, 3);
  // Drives the "2 of 3" aggregate badge on the collapsed parent row — the
  // point of which is seeing a disconnected location without expanding.
  assert.equal(group.connectedCount, 2);
});

test("groups and singles sort together alphabetically", () => {
  const entries = groupByBrand([
    c({ name: "Zebra Fitness" }),
    c({ name: "Carefree Boat Club - A" }),
    c({ name: "Carefree Boat Club - B" }),
    c({ name: "Anchor Marina" }),
  ]);
  const names = entries.map((e) => (e.kind === "group" ? e.brand : e.client.name));
  assert.deepEqual(names, ["Anchor Marina", "Carefree Boat Club", "Zebra Fitness"]);
});

test("search matches name, location description, market and landing URL", () => {
  const rows = [
    c({ name: "Glow Med Spa", location_description: "Scottsdale, AZ" }),
    c({ name: "Iron Hill Fitness", landing_page_url: "ironhill.com/join" }),
    c({ name: "Summit Realty", market_name: "Boise, ID" }),
  ];
  assert.equal(filterClients(rows, { query: "scottsdale", industry: "all" }).length, 1);
  assert.equal(filterClients(rows, { query: "ironhill.com", industry: "all" }).length, 1);
  assert.equal(filterClients(rows, { query: "boise", industry: "all" }).length, 1);
  assert.equal(filterClients(rows, { query: "nothing", industry: "all" }).length, 0);
});

test("search and industry filter compose with AND", () => {
  const rows = [
    c({ name: "Anchor Marina", industry: "marina" }),
    c({ name: "Anchor Fitness", industry: "fitness" }),
  ];
  assert.equal(filterClients(rows, { query: "anchor", industry: "all" }).length, 2);
  assert.equal(filterClients(rows, { query: "anchor", industry: "marina" }).length, 1);
  assert.equal(filterClients(rows, { query: "zzz", industry: "marina" }).length, 0);
});

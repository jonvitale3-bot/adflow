import assert from "node:assert/strict";
import { test } from "node:test";

import { pickBusinessName } from "./business-names.ts";

test("names the portfolio the way Business Manager does", () => {
  assert.equal(
    pickBusinessName([
      { business: { name: "SalesOptima" } },
      { business: { name: "SalesOptima" } },
    ]),
    "SalesOptima",
  );
});

test("a partner-shared account does not rename the portfolio", () => {
  const name = pickBusinessName([
    { business: { name: "Engage CRM" } },
    { business: { name: "Engage CRM" } },
    { business: { name: "Someone Else's BM" } },
  ]);
  assert.equal(name, "Engage CRM");
});

test("stays on one name when two are tied, rather than flipping per request", () => {
  const accounts = [{ business: { name: "Bravo" } }, { business: { name: "Alpha" } }];
  assert.equal(pickBusinessName(accounts), "Alpha");
  assert.equal(pickBusinessName([...accounts].reverse()), "Alpha");
});

test("has no name to offer when Meta gives none", () => {
  assert.equal(pickBusinessName([]), null);
  assert.equal(pickBusinessName([{ business: undefined }, { business: { name: "  " } }]), null);
});

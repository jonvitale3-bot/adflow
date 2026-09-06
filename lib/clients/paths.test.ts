import assert from "node:assert/strict";
import { test } from "node:test";

import { clientIdFromPath, clientPath, isUuid, sectionFromPath } from "./paths.ts";

const ID = "f6b9724e-45e0-4407-83b3-4eda1396f2e4";

test("a client's steps live under the client", () => {
  assert.equal(clientPath(ID, "creatives"), `/clients/${ID}/creatives`);
  assert.equal(clientPath(ID, "launch"), `/clients/${ID}/launch`);
});

test("the client is read back out of its own paths", () => {
  assert.equal(clientIdFromPath(`/clients/${ID}`), ID);
  assert.equal(clientIdFromPath(`/clients/${ID}/launch`), ID);
  assert.equal(clientIdFromPath(`/clients/${ID}/creatives`), ID);
});

test("the list, settings and API paths are not inside a client", () => {
  // The list must not read as "a client whose id is empty".
  assert.equal(clientIdFromPath("/clients"), null);
  assert.equal(clientIdFromPath("/clients/"), null);
  assert.equal(clientIdFromPath("/settings"), null);
  assert.equal(clientIdFromPath(`/api/clients/${ID}/defaults`), null);
  // Only a real id counts, so a typo cannot set the remembered client.
  assert.equal(clientIdFromPath("/clients/not-an-id/launch"), null);
});

test("the step is read back too", () => {
  assert.equal(sectionFromPath(`/clients/${ID}/launch`), "launch");
  assert.equal(sectionFromPath(`/clients/${ID}/creatives`), "creatives");
  assert.equal(sectionFromPath(`/clients/${ID}`), null);
  assert.equal(sectionFromPath("/clients"), null);
});

test("a cookie value is only trusted when it is an id", () => {
  assert.ok(isUuid(ID));
  assert.ok(!isUuid("../../etc"));
  assert.ok(!isUuid(""));
  assert.ok(!isUuid(undefined));
});

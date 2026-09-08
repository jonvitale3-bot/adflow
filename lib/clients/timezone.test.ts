import assert from "node:assert/strict";
import { test } from "node:test";

import { isValidTimeZone, timeZoneFromAdAccount, timeZoneOrDefault } from "./timezone.ts";

test("a real IANA zone is accepted and a made-up one is not", () => {
  assert.ok(isValidTimeZone("America/Los_Angeles"));
  assert.ok(isValidTimeZone("Pacific/Honolulu"));
  assert.ok(!isValidTimeZone("Pacific/Nowhere"));
  assert.ok(!isValidTimeZone(""));
  assert.ok(!isValidTimeZone(null));
});

test("anything invalid falls back to the old default rather than throwing", () => {
  assert.equal(timeZoneOrDefault("America/Chicago"), "America/Chicago");
  assert.equal(timeZoneOrDefault("Pacific/Nowhere"), "America/New_York");
  assert.equal(timeZoneOrDefault(undefined), "America/New_York");
});

test("the ad account zone is trusted only when it is usable", () => {
  assert.equal(timeZoneFromAdAccount("America/Denver"), "America/Denver");
  assert.equal(timeZoneFromAdAccount(""), null);
  assert.equal(timeZoneFromAdAccount("garbage"), null);
});

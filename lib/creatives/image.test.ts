import assert from "node:assert/strict";
import { test } from "node:test";

import { isAccepted, storagePath } from "./image.ts";

test("only the three formats Meta accepts are allowed in", () => {
  assert.equal(isAccepted({ type: "image/jpeg" } as File), true);
  assert.equal(isAccepted({ type: "image/png" } as File), true);
  // WebP is accepted at the picker, then converted — Meta rejects it directly.
  assert.equal(isAccepted({ type: "image/webp" } as File), true);
  assert.equal(isAccepted({ type: "image/gif" } as File), false);
  assert.equal(isAccepted({ type: "application/pdf" } as File), false);
});

test("storage paths are namespaced per client and unique", () => {
  const a = storagePath("client-1", "jpg");
  const b = storagePath("client-1", "jpg");
  assert.match(a, /^client-1\/\d+_[a-z0-9]+\.jpg$/);
  assert.notEqual(a, b, "two uploads in the same millisecond must not collide");
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { sumStats, tallyStats } from "./stats.ts";

test("each client's work is counted separately", () => {
  const stats = tallyStats(
    [{ client_id: "a" }, { client_id: "a" }, { client_id: "b" }],
    [{ client_id: "a" }],
  );
  assert.deepEqual(stats.a, { creatives: 2, drafts: 1 });
  assert.deepEqual(stats.b, { creatives: 1, drafts: 0 });
});

test("a client with nothing at all is simply absent, and sums treat it as zero", () => {
  const stats = tallyStats([], [{ client_id: "b" }]);
  assert.equal(stats.a, undefined);
  assert.deepEqual(sumStats(["a", "b"], stats), { creatives: 0, drafts: 1 });
});

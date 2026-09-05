import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import { cached, resetCache } from "./cache.ts";

beforeEach(resetCache);

/** A clock the test moves by hand, so expiry is exact rather than timed. */
function clock(start = 0) {
  let at = start;
  return { now: () => at, advance: (ms: number) => (at += ms) };
}

test("a second read inside the window does not call Meta again", async () => {
  const { now } = clock();
  let calls = 0;
  const load = async () => (calls += 1);

  await cached("k", load, { ttlMs: 1000, now });
  await cached("k", load, { ttlMs: 1000, now });

  assert.equal(calls, 1);
});

test("the value is the one that was stored", async () => {
  const { now } = clock();
  const first = await cached("k", async () => ["a"], { ttlMs: 1000, now });
  const second = await cached("k", async () => ["b"], { ttlMs: 1000, now });

  assert.deepEqual(second, first);
  assert.deepEqual(second, ["a"]);
});

test("it asks again once the window has passed", async () => {
  const c = clock();
  let calls = 0;
  const load = async () => (calls += 1);

  await cached("k", load, { ttlMs: 1000, now: c.now });
  c.advance(1001);
  await cached("k", load, { ttlMs: 1000, now: c.now });

  assert.equal(calls, 2);
});

test("different keys do not share an answer", async () => {
  const { now } = clock();
  const a = await cached("a", async () => "A", { ttlMs: 1000, now });
  const b = await cached("b", async () => "B", { ttlMs: 1000, now });

  assert.equal(a, "A");
  assert.equal(b, "B");
});

test("two callers at once make one request", async () => {
  const { now } = clock();
  let calls = 0;
  const load = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 5));
    return calls;
  };

  // The duplicate is as costly as the repeat: switching client twice quickly
  // fires the same lookup twice, and effects run twice in development.
  const [a, b] = await Promise.all([
    cached("k", load, { ttlMs: 1000, now }),
    cached("k", load, { ttlMs: 1000, now }),
  ]);

  assert.equal(calls, 1);
  assert.equal(a, b);
});

test("a failure is not remembered", async () => {
  const { now } = clock();
  let calls = 0;
  const load = async () => {
    calls += 1;
    if (calls === 1) throw new Error("There have been too many calls");
    return "ok";
  };

  // Caching a rate limit would extend the outage rather than soften it.
  await assert.rejects(cached("k", load, { ttlMs: 1000, now }));
  assert.equal(await cached("k", load, { ttlMs: 1000, now }), "ok");
  assert.equal(calls, 2);
});

test("a failure does not wedge the key", async () => {
  const { now } = clock();
  await assert.rejects(
    cached("k", async () => {
      throw new Error("nope");
    }, { ttlMs: 1000, now }),
  );

  // An in-flight entry left behind would make every later call reject with the
  // same stale error, forever.
  assert.equal(await cached("k", async () => "fine", { ttlMs: 1000, now }), "fine");
});

test("refresh skips the stored value", async () => {
  const { now } = clock();
  let calls = 0;
  const load = async () => (calls += 1);

  await cached("k", load, { ttlMs: 1000, now });
  await cached("k", load, { ttlMs: 1000, refresh: true, now });

  assert.equal(calls, 2);
});

test("refresh still shares one request with anything in flight", async () => {
  const { now } = clock();
  let calls = 0;
  const load = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 5));
    return calls;
  };

  await Promise.all([
    cached("k", load, { ttlMs: 1000, refresh: true, now }),
    cached("k", load, { ttlMs: 1000, refresh: true, now }),
  ]);

  assert.equal(calls, 1);
});

test("the cache stays bounded", async () => {
  const { now } = clock();
  for (let i = 0; i < 400; i++) {
    await cached(`k${i}`, async () => i, { ttlMs: 1000, now });
  }

  // The most recent key must still be there; only the oldest are dropped.
  let calls = 0;
  await cached("k399", async () => (calls += 1), { ttlMs: 1000, now });
  assert.equal(calls, 0);
});

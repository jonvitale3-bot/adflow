import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_RATIO, PLACEMENTS, ratioForPreview, ratioOf } from "./ratios.ts";

test("a 1:1 image is a feed asset", () => {
  assert.equal(ratioOf(1080, 1080), "square");
});

test("4:5 counts as feed, not as a story asset", () => {
  // Meta's tall feed image. Sending it to stories would letterbox it.
  assert.equal(ratioOf(1080, 1350), "square");
});

test("9:16 is a story asset", () => {
  assert.equal(ratioOf(1080, 1920), "vertical");
});

test("1.91:1 is a banner asset", () => {
  assert.equal(ratioOf(1200, 628), "horizontal");
});

test("a broken or unknown size falls back to the shape that runs everywhere", () => {
  assert.equal(ratioOf(0, 0), "square");
  assert.equal(ratioOf(-1, 100), "square");
  assert.equal(DEFAULT_RATIO, "square");
});

test("no ratio claims a placement another ratio also claims", () => {
  const seen = new Set<string>();
  for (const spec of Object.values(PLACEMENTS)) {
    for (const [platform, positions] of Object.entries(spec)) {
      if (platform === "publisher_platforms") continue;
      for (const position of positions as string[]) {
        const slot = `${platform}:${position}`;
        assert.ok(!seen.has(slot), `${slot} is claimed twice`);
        seen.add(slot);
      }
    }
  }
});

test("a story preview shows the vertical, a feed preview the square", () => {
  assert.equal(ratioForPreview("INSTAGRAM_STORY"), "vertical");
  assert.equal(ratioForPreview("FACEBOOK_STORY_MOBILE"), "vertical");
  assert.equal(ratioForPreview("MOBILE_FEED_STANDARD"), "square");
});

test("an unknown placement previews the shape that fits anywhere", () => {
  assert.equal(ratioForPreview("SOME_NEW_PLACEMENT"), "square");
});

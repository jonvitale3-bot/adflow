import assert from "node:assert/strict";
import { test } from "node:test";

import { groupByStem, groupKey, stemOf } from "./filenames.ts";

test("strips an aspect ratio from the end", () => {
  assert.equal(stemOf("bay-pines-storage-1x1.jpg"), "bay-pines-storage");
  assert.equal(stemOf("bay-pines-storage-9x16.jpg"), "bay-pines-storage");
  assert.equal(stemOf("bay-pines-storage-4x5.png"), "bay-pines-storage");
});

test("strips pixel dimensions", () => {
  assert.equal(stemOf("storage_1080x1080.jpg"), "storage");
  assert.equal(stemOf("storage_1200x628.jpg"), "storage");
});

test("strips the words designers use", () => {
  assert.equal(stemOf("tiki-bar-square.jpg"), "tiki-bar");
  assert.equal(stemOf("tiki-bar-story.jpg"), "tiki-bar");
  assert.equal(stemOf("tiki bar vertical.jpeg"), "tiki bar");
  assert.equal(stemOf("tiki-bar-reel.jpg"), "tiki-bar");
});

test("strips a ratio and a pixel size together", () => {
  assert.equal(stemOf("hero-1x1-1080x1080.jpg"), "hero");
});

test("only strips from the end, so a name that starts with a size survives", () => {
  assert.equal(stemOf("1x1-hero.jpg"), "1x1-hero");
});

test("a name with no size marker is left alone", () => {
  assert.equal(stemOf("great-service-great-staff.jpg"), "great-service-great-staff");
  assert.equal(stemOf("ad-2.jpg"), "ad-2");
});

test("the same set exported with different separators still groups", () => {
  assert.equal(groupKey("Bay Pines Storage 1x1.jpg"), groupKey("bay_pines_storage-9x16.png"));
});

test("groups a mixed drop into one creative per set", () => {
  const files = [
    "storage-1x1.jpg",
    "storage-9x16.jpg",
    "storage-1200x628.jpg",
    "tiki-bar-square.jpg",
    "tiki-bar-story.jpg",
    "lone-photo.jpg",
  ];
  const groups = groupByStem(files, (f) => f);

  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((g) => g.files.length), [3, 2, 1]);
  assert.equal(groups[0]!.stem, "storage");
  assert.equal(groups[2]!.stem, "lone-photo");
});

test("order within a group is the order dropped", () => {
  const groups = groupByStem(["a-9x16.jpg", "a-1x1.jpg"], (f) => f);
  assert.deepEqual(groups[0]!.files, ["a-9x16.jpg", "a-1x1.jpg"]);
});

test("the abbreviations designers actually type are size markers", () => {
  // "Horz" came from a real export. The list stays at what exports use:
  // "hor", "port" and "land" were tried and reached into real names.
  assert.equal(stemOf("hero-horz.jpg"), "hero");
  assert.equal(stemOf("hero-sqr.jpg"), "hero");
  assert.equal(groupKey("Keys_4-Horz.png"), groupKey("Keys_4-Sq.png"));
  assert.equal(groupKey("Keys_4-Vert.png"), groupKey("Keys_4-Sq.png"));
});

test("a size word before the variant number is stripped and the number kept", () => {
  // The real export: three sizes of five ads, numbered after the size word.
  assert.equal(groupKey("NorCal_Sept26_Horz-5.png"), groupKey("NorCal_Sept26_Vert-5.png"));
  assert.equal(groupKey("NorCal_Sept26_Horz-5.png"), groupKey("NorCal-Sept26_Sq-5.png"));
  // The number is what tells ad 5 from ad 4.
  assert.notEqual(groupKey("NorCal_Sept26_Horz-5.png"), groupKey("NorCal_Sept26_Horz-4.png"));
  assert.equal(stemOf("NorCal_Sept26_Horz-5.png"), "NorCal_Sept26-5");
  // Attached or separated, the number survives the same way.
  assert.equal(groupKey("hero_vert5.jpg"), groupKey("hero-sq-5.jpg"));
});

test("a size word inside a real name is left alone", () => {
  // "port" and "land" were in the list briefly; Port Orange is a market.
  assert.equal(stemOf("port-orange-1x1.jpg"), "port-orange");
  assert.equal(stemOf("the-landing-2.jpg"), "the-landing-2");
  assert.equal(stemOf("1x1-hero.jpg"), "1x1-hero");
});

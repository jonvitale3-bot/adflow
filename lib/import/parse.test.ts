import assert from "node:assert/strict";
import { test } from "node:test";

import { applyMapping, matchCreative, suggestMapping } from "./parse.ts";

test("this app's own export headers map with no manual work", () => {
  // "Export, edit in Sheets with the client, re-import" is the common path and
  // must need zero mapping.
  const mapping = suggestMapping(["Headline", "Primary Text", "Image File", "Angle"]);
  assert.equal(mapping.headline, "Headline");
  assert.equal(mapping.primary_text, "Primary Text");
  assert.equal(mapping.image, "Image File");
  assert.equal(mapping.angle, "Angle");
});

test("common alternative headers are recognised", () => {
  const mapping = suggestMapping(["Title", "Ad Copy", "Creative"]);
  assert.equal(mapping.headline, "Title");
  assert.equal(mapping.primary_text, "Ad Copy");
  assert.equal(mapping.image, "Creative");
});

test("a column is never assigned to two fields", () => {
  const mapping = suggestMapping(["Headline", "Headline Notes"]);
  const used = Object.values(mapping);
  assert.equal(new Set(used).size, used.length);
});

test("unrecognised headers simply go unmapped", () => {
  const mapping = suggestMapping(["Column A", "Column B"]);
  assert.equal(mapping.headline, undefined);
  assert.equal(mapping.primary_text, undefined);
});

test("rows import with the mapped columns", () => {
  const { rows, problems } = applyMapping(
    [{ Headline: "Your Boat Is Waiting", Body: "Line one.\nLine two." }],
    { headline: "Headline", primary_text: "Body" },
  );
  assert.equal(problems.length, 0);
  assert.equal(rows[0]!.headline, "Your Boat Is Waiting");
  assert.equal(rows[0]!.primary_text, "Line one.\nLine two.");
  // Row 2, because row 1 is the header.
  assert.equal(rows[0]!.rowNumber, 2);
});

test("trailing blank rows are ignored, not reported", () => {
  const { rows, problems } = applyMapping(
    [{ H: "Real headline", B: "Real body" }, { H: "", B: "" }, { H: "  ", B: " " }],
    { headline: "H", primary_text: "B" },
  );
  assert.equal(rows.length, 1);
  assert.equal(problems.length, 0);
});

test("a half-filled row is reported and skipped, never imported empty", () => {
  const { rows, problems } = applyMapping(
    [{ H: "Has headline", B: "" }, { H: "", B: "Has body" }],
    { headline: "H", primary_text: "B" },
  );
  assert.equal(rows.length, 0);
  assert.equal(problems.length, 2);
  assert.match(problems[0]!.message, /primary text/i);
  assert.match(problems[1]!.message, /headline/i);
  assert.equal(problems[0]!.rowNumber, 2);
});

const creatives = [
  { id: "a", label: "summer-cruising", storage_path: "client/1700_abcd.jpg" },
  { id: "b", label: null, storage_path: "client/ad-01-your-boat.png" },
];

test("an image reference matches a creative label, ignoring case and extension", () => {
  assert.equal(matchCreative("Summer-Cruising", creatives)?.id, "a");
  assert.equal(matchCreative("summer-cruising.jpg", creatives)?.id, "a");
});

test("an image reference falls back to matching the stored filename", () => {
  assert.equal(matchCreative("ad-01-your-boat", creatives)?.id, "b");
  assert.equal(matchCreative("ad-01-your-boat.png", creatives)?.id, "b");
});

test("an unmatched or missing reference yields null rather than a wrong image", () => {
  assert.equal(matchCreative("nothing-like-this", creatives), null);
  assert.equal(matchCreative(undefined, creatives), null);
});

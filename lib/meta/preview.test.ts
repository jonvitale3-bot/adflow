import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePreviewFrame } from "./preview.ts";

const REAL = `<iframe src="https://www.facebook.com/ads/api/preview_iframe.php?d=abc&amp;t=xyz" width="340" height="680" scrolling="yes" style="border:none;"></iframe>`;

test("reads the src and unescapes its query separators", () => {
  const frame = parsePreviewFrame(REAL);
  assert.equal(
    frame?.src,
    "https://www.facebook.com/ads/api/preview_iframe.php?d=abc&t=xyz",
  );
});

test("keeps the dimensions Meta chose for the placement", () => {
  const frame = parsePreviewFrame(REAL);
  assert.equal(frame?.width, 340);
  assert.equal(frame?.height, 680);
});

test("falls back to a portrait box when Meta omits the size", () => {
  const frame = parsePreviewFrame(`<iframe src="https://example.com/p"></iframe>`);
  assert.equal(frame?.width, 360);
  assert.equal(frame?.height, 640);
});

test("returns nothing when there is no preview to render", () => {
  assert.equal(parsePreviewFrame(null), null);
  assert.equal(parsePreviewFrame(""), null);
  assert.equal(parsePreviewFrame("<iframe></iframe>"), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeSheetBytes } from "./decode.ts";

const STAR = "★";
const EM_DASH = "—";
const ELLIPSIS = "…";

const CSV = `Headline,Primary text\nRated 4.7${STAR},"Storage, fuel ${EM_DASH} one stop${ELLIPSIS} done"\n`;

test("a UTF-8 CSV keeps its punctuation", () => {
  // Read as Windows-1252 these come back as strings of junk characters, which
  // is exactly the mangling this exists to prevent.
  const out = decodeSheetBytes(new TextEncoder().encode(CSV));
  assert.equal(out.kind, "text");
  assert.ok(out.kind === "text" && out.text.includes(STAR));
  assert.ok(out.kind === "text" && out.text.includes(EM_DASH));
  assert.ok(out.kind === "text" && out.text.includes(ELLIPSIS));
  assert.equal(out.kind === "text" && out.encoding, "utf-8");
});

test("a byte-order mark is stripped, not read as a header character", () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(CSV)]);
  const out = decodeSheetBytes(bytes);
  assert.ok(out.kind === "text" && out.text.startsWith("Headline"));
});

test("a Windows-1252 CSV from Excel is not mangled either", () => {
  // 0x97 is an em dash in Windows-1252 and invalid on its own in UTF-8.
  const bytes = new Uint8Array([
    ...new TextEncoder().encode("Headline,Primary text\nA,Storage "),
    0x97,
    ...new TextEncoder().encode(" one stop\n"),
  ]);
  const out = decodeSheetBytes(bytes);
  assert.equal(out.kind === "text" && out.encoding, "windows-1252");
  assert.ok(out.kind === "text" && out.text.includes(EM_DASH));
});

test("an xlsx is left to the parser as bytes", () => {
  // "PK", the zip magic every xlsx starts with.
  const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  assert.equal(decodeSheetBytes(bytes).kind, "binary");
});

test("a legacy .xls is left to the parser as bytes", () => {
  const bytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]);
  assert.equal(decodeSheetBytes(bytes).kind, "binary");
});

test("an empty file does not throw", () => {
  assert.equal(decodeSheetBytes(new Uint8Array()).kind, "text");
});

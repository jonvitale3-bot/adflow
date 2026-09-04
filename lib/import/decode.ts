/**
 * Working out what an uploaded sheet actually is, before parsing it.
 *
 * A .xlsx is a zip of UTF-8 XML and the parser handles it byte for byte. A CSV
 * is just text, and text without an encoding is not text: read UTF-8 bytes as
 * Windows-1252 and every em dash arrives as three junk characters, every star
 * as two. Excel on Windows writes Windows-1252 CSVs, Sheets and Numbers write
 * UTF-8, and only some of them leave a byte-order mark to say which.
 *
 * So the bytes are inspected rather than trusted to a file extension, which a
 * client renaming an export can get wrong anyway.
 */

export type SheetBytes =
  | { kind: "binary" }
  | { kind: "text"; text: string; encoding: "utf-8" | "windows-1252" };

/** Zip: .xlsx and .ods. */
function isZip(b: Uint8Array): boolean {
  return b[0] === 0x50 && b[1] === 0x4b;
}

/** OLE compound file: legacy .xls. */
function isOle(b: Uint8Array): boolean {
  return b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0;
}

function hasUtf8Bom(b: Uint8Array): boolean {
  return b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
}

export function decodeSheetBytes(bytes: Uint8Array): SheetBytes {
  if (bytes.length === 0) return { kind: "text", text: "", encoding: "utf-8" };
  if (isZip(bytes) || isOle(bytes)) return { kind: "binary" };

  // A byte-order mark settles the question outright.
  if (hasUtf8Bom(bytes)) {
    return {
      kind: "text",
      text: new TextDecoder("utf-8").decode(bytes.subarray(3)),
      encoding: "utf-8",
    };
  }

  // No mark, so try UTF-8 strictly. Text that decodes cleanly as UTF-8 is
  // essentially never the Windows-1252 text someone meant instead.
  try {
    return {
      kind: "text",
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf-8",
    };
  } catch {
    // Not UTF-8. Windows-1252 accepts every byte, so this always succeeds, and
    // it is what Excel on Windows produces.
    return {
      kind: "text",
      text: new TextDecoder("windows-1252").decode(bytes),
      encoding: "windows-1252",
    };
  }
}

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { decodeSheetBytes } from "@/lib/import/decode";
import {
  applyMapping,
  findHeaderRow,
  suggestMapping,
  type ImportField,
} from "@/lib/import/parse";
import { validateVariation } from "@/lib/generation/validate";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 500;

/**
 * Parses an uploaded sheet and returns a preview. Parsing is server-side
 * deliberately — this library has had advisories and the file is untrusted.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const mappingRaw = form.get("mapping");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 5 MB" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // A CSV is bytes until something says what encoding they are in. Handing
  // them to the parser raw made it guess, and it guessed Windows-1252, so a
  // UTF-8 sheet arrived with every dash, star and ellipsis in pieces.
  const decoded = decodeSheetBytes(bytes);

  let workbook: XLSX.WorkBook;
  try {
    workbook =
      decoded.kind === "binary"
        ? XLSX.read(bytes, { type: "array" })
        : XLSX.read(decoded.text, { type: "string" });
  } catch {
    return NextResponse.json(
      { error: "Could not read that file. Export it as .xlsx or .csv and try again." },
      { status: 400 },
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return NextResponse.json({ error: "That file has no sheets" }, { status: 400 });
  }

  const sheet = workbook.Sheets[sheetName]!;

  // Find the header row before trusting it. A sheet from a designer or a
  // client often opens with a title and a note, and reading row 1 as the
  // column names meant no headline column existed and the import did nothing.
  const grid = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  });
  const headerRow = findHeaderRow(grid.map((r) => (r ?? []).map((c) => String(c ?? ""))));

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    range: headerRow,
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "That sheet has no rows" }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `That sheet has ${rows.length} rows; the limit is ${MAX_ROWS}.` },
      { status: 400 },
    );
  }

  const stringRows = rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? "")])),
  );
  const headers = Object.keys(stringRows[0] ?? {});

  const mapping: Partial<Record<ImportField, string>> = mappingRaw
    ? JSON.parse(String(mappingRaw))
    : suggestMapping(headers);

  // Without these two columns there is no ad, and returning an empty preview
  // reads as "nothing happened" rather than "I could not find your copy".
  if (!mapping.headline || !mapping.primary_text) {
    const missing = [!mapping.headline && "headline", !mapping.primary_text && "primary text"]
      .filter(Boolean)
      .join(" and ");
    return NextResponse.json(
      {
        error: `Could not find a ${missing} column. The columns read were: ${headers
          .filter((h) => !/^__EMPTY/.test(h))
          .join(", ")}. Pick the columns by hand, or rename them in the sheet.`,
        headers,
        mapping,
        headerRow,
      },
      { status: 400 },
    );
  }

  const { rows: mapped, problems } = applyMapping(stringRows, mapping, headerRow);

  // Copy rules run as WARNINGS here, never rejections. Human-written copy is a
  // deliberate choice; the app flags, the operator decides.
  const preview = mapped.slice(0, 100).map((row) => ({
    ...row,
    warnings: validateVariation({
      headline: row.headline,
      primary_text: row.primary_text,
    }),
  }));

  return NextResponse.json({
    sheetName,
    sheetNames: workbook.SheetNames,
    headerRow,
    headers,
    mapping,
    total: mapped.length,
    problems,
    preview,
  });
}

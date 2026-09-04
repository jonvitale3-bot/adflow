import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { applyMapping, suggestMapping, type ImportField } from "@/lib/import/parse";
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

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
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

  const { rows: mapped, problems } = applyMapping(stringRows, mapping);

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
    headers,
    mapping,
    total: mapped.length,
    problems,
    preview,
  });
}

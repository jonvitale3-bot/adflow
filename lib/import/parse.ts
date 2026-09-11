/**
 * Spreadsheet copy import.
 *
 * Lets ad copy come from anywhere — written by hand, supplied by a client,
 * edited in Sheets — rather than only from the generator. Parsing happens on
 * the server: this library has had security advisories, and a spreadsheet a
 * client emailed you is exactly the wrong thing to parse in the browser.
 */

export interface ParsedSheet {
  headers: string[];
  rows: Array<Record<string, string>>;
  sheetNames: string[];
}

/** The fields an import can fill. */
export type ImportField =
  | "headline"
  | "primary_text"
  | "image"
  | "angle";

export const IMPORT_FIELDS: Array<{ key: ImportField; label: string; required: boolean }> = [
  { key: "headline", label: "Headline", required: true },
  { key: "primary_text", label: "Primary text", required: true },
  { key: "image", label: "Image (label or filename)", required: false },
  { key: "angle", label: "Angle", required: false },
];

/**
 * Guesses a column for each field from the header row.
 *
 * The most common import is this app's own Excel export, so its exact headers
 * are matched first — "export, edit with the client in Sheets, re-import"
 * should need no mapping at all.
 */
const SIGNALS: Record<ImportField, RegExp[]> = {
  headline: [/^headline$/i, /^head(line)?$/i, /^title$/i, /headline/i],
  primary_text: [
    /^primary\s*text$/i,
    /^body$/i,
    /^copy$/i,
    /^ad\s*copy$/i,
    /primary/i,
    /body/i,
  ],
  image: [/^image\s*file$/i, /^image$/i, /^creative$/i, /^filename$/i, /image/i],
  angle: [/^angle$/i, /^theme$/i, /angle/i],
};

/**
 * Which row holds the column names.
 *
 * A sheet handed over by a designer or a client rarely starts with its header
 * row. This one opened with a title banner, a line of notes and a blank row,
 * so the parser took the title as the only column name and found no headline
 * column at all: the upload did nothing, with nothing to say about why.
 *
 * Scored rather than assumed. A header row has several non-empty cells and
 * tends to contain the words this importer already knows how to map, while a
 * title banner is one long cell and a notes line is prose.
 */
export function findHeaderRow(grid: string[][], limit = 15): number {
  let best = 0;
  let bestScore = -1;

  for (let i = 0; i < Math.min(grid.length, limit); i++) {
    const cells = (grid[i] ?? []).map((c) => (c ?? "").trim());
    const filled = cells.filter(Boolean);
    // A single cell is a title, not a header row.
    if (filled.length < 2) continue;
    // Nothing underneath it means it is a trailing note, not a header.
    if (!(grid[i + 1] ?? []).some((c) => (c ?? "").trim())) continue;

    // A header names things; it does not write sentences.
    const wordy = filled.filter((c) => c.length > 40).length;
    const known = filled.filter((c) =>
      Object.values(SIGNALS).some((patterns) => patterns.some((p) => p.test(c))),
    ).length;

    const score = known * 10 + filled.length - wordy * 5;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }

  return best;
}

export function suggestMapping(headers: string[]): Partial<Record<ImportField, string>> {
  const mapping: Partial<Record<ImportField, string>> = {};
  const taken = new Set<string>();

  for (const field of Object.keys(SIGNALS) as ImportField[]) {
    for (const pattern of SIGNALS[field]) {
      const match = headers.find((h) => !taken.has(h) && pattern.test(h.trim()));
      if (match) {
        mapping[field] = match;
        taken.add(match);
        break;
      }
    }
  }

  return mapping;
}

export interface ImportRow {
  rowNumber: number;
  headline: string;
  primary_text: string;
  image?: string;
  angle?: string;
}

export interface RowProblem {
  rowNumber: number;
  message: string;
}

/**
 * Applies a mapping. A row missing required content is skipped and reported
 * rather than imported empty — a blank headline becomes a blank ad.
 */
export function applyMapping(
  rows: Array<Record<string, string>>,
  mapping: Partial<Record<ImportField, string>>,
  /** Where the header row sat, so reported row numbers match the sheet. */
  headerRow = 0,
): { rows: ImportRow[]; problems: RowProblem[] } {
  const out: ImportRow[] = [];
  const problems: RowProblem[] = [];

  const headlineCol = mapping.headline;
  const bodyCol = mapping.primary_text;

  rows.forEach((raw, index) => {
    // +2: one for the header row, one because spreadsheets are 1-indexed.
    // Plus wherever the header actually was, when it was not the first row.
    const rowNumber = index + headerRow + 2;

    const headline = headlineCol ? (raw[headlineCol] ?? "").trim() : "";
    const primaryText = bodyCol ? (raw[bodyCol] ?? "").trim() : "";

    // Trailing blank rows are normal in a spreadsheet and are not worth
    // reporting as errors.
    if (!headline && !primaryText) return;

    if (!headline) {
      problems.push({ rowNumber, message: "No headline" });
      return;
    }
    if (!primaryText) {
      problems.push({ rowNumber, message: "No primary text" });
      return;
    }

    out.push({
      rowNumber,
      headline,
      primary_text: primaryText,
      image: mapping.image ? (raw[mapping.image] ?? "").trim() || undefined : undefined,
      angle: mapping.angle ? (raw[mapping.angle] ?? "").trim() || undefined : undefined,
    });
  });

  return { rows: out, problems };
}

/**
 * Matches an image reference to a creative.
 *
 * Compares against the creative's label and its stored filename, ignoring case
 * and extension, so "ad-01-your-boat-is-waiting" matches whether or not the
 * sheet carries ".jpg".
 */
export function matchCreative<T extends { id: string; label: string | null; storage_path: string }>(
  reference: string | undefined,
  creatives: T[],
): T | null {
  if (!reference) return null;

  const normalize = (v: string) =>
    v.toLowerCase().trim().replace(/\.(jpe?g|png|webp)$/i, "");

  const target = normalize(reference);

  return (
    creatives.find((c) => c.label && normalize(c.label) === target) ??
    creatives.find((c) => {
      const filename = c.storage_path.split("/").pop() ?? "";
      return normalize(filename) === target;
    }) ??
    null
  );
}

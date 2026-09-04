/**
 * Grouping an upload by filename.
 *
 * A designer exporting one ad in three ratios names the files for it:
 * "bay-pines-storage-1x1.jpg", "bay-pines-storage-9x16.jpg",
 * "bay-pines-storage_1200x628.jpg". Those are one creative in three shapes,
 * and dropping them in should say so rather than making three creatives that
 * happen to look alike.
 *
 * The size token is stripped and what remains is the group. The token itself
 * is NOT used to decide the ratio: the file's own dimensions are ground truth,
 * and a designer renaming an export is exactly how a story ends up labelled
 * square.
 */

/** Trailing size markers, in the forms exports actually use. */
const SIZE_TOKEN = new RegExp(
  [
    // Aspect ratios: 1x1, 4x5, 9x16, 1.91x1.
    String.raw`\d{1,3}(?:[.,]\d{1,2})?x\d{1,3}(?:[.,]\d{1,2})?`,
    // Pixel dimensions: 1080x1080, 1200x628.
    String.raw`\d{3,4}\s*[x×]\s*\d{3,4}`,
    // Words.
    String.raw`(?:squares?|sq|verticals?|vert|portraits?|stor(?:y|ies)|reels?|landscapes?|horizontals?|horiz|wide|banners?|feed)`,
  ].join("|"),
  "i",
);

const EXTENSION = /\.(jpe?g|png|webp|gif|avif)$/i;
const SEPARATOR = /[\s._-]+$/;

/**
 * The name with its extension and any trailing size marker removed.
 *
 * Only trailing markers are stripped: "1x1-hero" is a name, "hero-1x1" is a
 * size. Stripping repeats, so "hero-1x1-1080x1080" reduces to "hero".
 */
export function stemOf(filename: string): string {
  let stem = filename.replace(EXTENSION, "").trim();

  // Repeat, because exports carry both a ratio and a pixel size often enough.
  for (let pass = 0; pass < 3; pass++) {
    const next = stem.replace(new RegExp(`[\\s._-]+(?:${SIZE_TOKEN.source})$`, "i"), "");
    if (next === stem) break;
    stem = next;
  }

  return stem.replace(SEPARATOR, "").trim();
}

/** Case and separators vary between exports of the same set. */
export function groupKey(filename: string): string {
  return stemOf(filename).toLowerCase().replace(/[\s._-]+/g, "-");
}

export interface Group<T> {
  /** The name, as written, for use as the creative's label. */
  stem: string;
  key: string;
  files: T[];
}

/**
 * Groups files that are the same creative in different shapes.
 *
 * Order within a group follows the order dropped, so the caller can fall back
 * to "the first one" when no file is square.
 */
export function groupByStem<T>(files: T[], nameOf: (file: T) => string): Group<T>[] {
  const groups = new Map<string, Group<T>>();

  for (const file of files) {
    const name = nameOf(file);
    const key = groupKey(name);
    const existing = groups.get(key);
    if (existing) existing.files.push(file);
    else groups.set(key, { stem: stemOf(name), key, files: [file] });
  }

  return [...groups.values()];
}

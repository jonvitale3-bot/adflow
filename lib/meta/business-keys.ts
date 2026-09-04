/**
 * Business portfolio keys. Pure helpers — a key becomes part of an environment
 * variable name, so it is validated rather than trusted.
 */

export const DEFAULT_BUSINESS_KEY = "default";

export function isValidBusinessKey(key: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,30}$/.test(key);
}

export function envNameFor(key: string): string {
  if (key === DEFAULT_BUSINESS_KEY) return "META_ACCESS_TOKEN";
  return `META_ACCESS_TOKEN_${key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

/** "engage" -> "Engage", "second_bm" -> "Second bm". For display only. */
export function businessLabel(key: string): string {
  if (key === DEFAULT_BUSINESS_KEY) return "Default portfolio";
  const spaced = key.replace(/[_-]+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

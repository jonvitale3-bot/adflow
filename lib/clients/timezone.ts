/**
 * Where a client's clock is.
 *
 * Every date this app reasons about is the client's, not the server's: which
 * part of the season the copy is written for, what day goes in an ad name.
 * Vercel runs on UTC and the old code fell back to New York for everyone.
 */

export const DEFAULT_TIMEZONE = "America/New_York";

/** An IANA zone the runtime can actually format in. */
export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** The zone to use, given whatever is stored. */
export function timeZoneOrDefault(value: string | null | undefined): string {
  return isValidTimeZone(value) ? value : DEFAULT_TIMEZONE;
}

/**
 * Meta returns the ad account zone as an IANA name already, so this is only a
 * guard against an empty or malformed value.
 */
export function timeZoneFromAdAccount(timezoneName: string | null | undefined): string | null {
  return isValidTimeZone(timezoneName) ? timezoneName : null;
}

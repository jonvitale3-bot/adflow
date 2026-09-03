
/** Lowercase, alphanumeric, hyphen-separated. Used for UTM values and ad names. */
export function slugify(input: string, maxLength = 40): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

export function buildUrlTags(clientName: string, headline: string): string {
  return new URLSearchParams({
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: slugify(clientName),
    utm_content: slugify(headline),
  }).toString();
}

/** Appends UTM params to a landing page URL, respecting an existing query string. */
export function appendUrlTags(link: string, urlTags: string): string {
  if (!urlTags) return link;
  return link.includes("?") ? `${link}&${urlTags}` : `${link}?${urlTags}`;
}

/**
 * Ad name: `{client} - {headline} - {YYYY-MM-DD}`.
 *
 * The old build used `toISOString().slice(0,10)` — a UTC date — so an evening
 * push in US time was stamped with tomorrow's date. Dates are formatted in the
 * client's own timezone instead.
 */
export function buildAdName(
  clientName: string,
  headline: string,
  timeZone = "America/New_York",
  now = new Date(),
): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return `${clientName} - ${headline} - ${date}`;
}

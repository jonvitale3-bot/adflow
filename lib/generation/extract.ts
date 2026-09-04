/**
 * Deterministic extraction from page HTML.
 *
 * These are exact values present in the markup — no inference, so no model is
 * involved and nothing can be hallucinated.
 */

/**
 * Meta Pixel ID from a landing page.
 *
 * Every Meta pixel install calls fbq('init', '<id>'). Some pages also carry a
 * noscript tracking image with the id as a query parameter.
 */
export function extractPixelId(html: string): string | null {
  const patterns = [
    /fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/,
    /facebook\.com\/tr\?id=(\d{10,20})/,
    /["']pixel_?id["']\s*:\s*["'](\d{10,20})["']/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match?.[1]) return match[1];
  }
  return null;
}

/**
 * Facebook Page from a link in the markup. Returns the slug or numeric id —
 * a slug still needs resolving through the Graph API before it can be used.
 */
export function extractFacebookPageRef(html: string): string | null {
  const match =
    /facebook\.com\/(?:profile\.php\?id=(\d+)|(?!tr\?|sharer|plugins|dialog)([A-Za-z0-9._-]{3,}))/.exec(
      html,
    );
  if (match?.[1]) return match[1];
  if (match?.[2] && !/^(tr|sharer|plugins|dialog|events|groups)$/i.test(match[2])) {
    return match[2];
  }
  return null;
}

/** Every Meta pixel on the page, when a site carries more than one. */
export function extractAllPixelIds(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/g)) {
    if (m[1]) found.add(m[1]);
  }
  for (const m of html.matchAll(/facebook\.com\/tr\?id=(\d{10,20})/g)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}

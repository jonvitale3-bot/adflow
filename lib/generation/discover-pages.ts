/**
 * Picks which pages of a client's site to read for brand voice.
 *
 * The old build hardcoded Carefree's own paths — /why-join, /how-it-works,
 * /the-carefree-difference (docs/SPEC.md §8) — so for every other client it
 * fetched three 404s and inferred a brand voice from the homepage alone.
 *
 * This scores the site's actual internal links instead, so it works for a med
 * spa, an insurance broker, or a boat club without knowing anything about them.
 */

/** Higher scores are read first. Ordered by how much brand voice a page carries. */
const PATH_SIGNALS: Array<[RegExp, number]> = [
  [/\b(about|about-us|our-story|who-we-are)\b/, 100],
  [/\b(why|why-us|why-choose|difference|the-.*-difference)\b/, 95],
  [/\b(how-it-works|how-we-work|process|our-approach)\b/, 90],
  [/\b(services|what-we-do|solutions|offerings)\b/, 80],
  [/\b(membership|pricing|plans|join)\b/, 70],
  [/\b(testimonials|reviews|clients|case-studies)\b/, 60],
];

/** Never worth reading for voice, and some are noise or legal boilerplate. */
const EXCLUDE = /\b(privacy|terms|cookie|sitemap|login|signin|cart|checkout|careers|jobs|blog\/|news\/|\.pdf|\.jpg|\.png|\.webp)\b/i;

export function scorePath(pathname: string): number {
  const p = pathname.toLowerCase();
  if (EXCLUDE.test(p)) return -1;
  if (p === "/" || p === "") return 1000; // homepage always wins

  for (const [pattern, score] of PATH_SIGNALS) {
    if (pattern.test(p)) return score;
  }

  // Shallow pages beat deep ones; a top-level page is more likely to be
  // positioning copy than a leaf.
  const depth = p.split("/").filter(Boolean).length;
  return depth === 1 ? 30 : 10;
}

/** Extracts same-origin links from an HTML document, deduped and normalized. */
export function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }

    if (url.hostname !== base.hostname) continue;

    url.hash = "";
    url.search = "";
    const normalized = url.toString().replace(/\/$/, "") || url.origin;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

/** Homepage plus the highest-signal internal pages, capped. */
export function selectPagesToRead(html: string, baseUrl: string, limit = 4): string[] {
  const base = new URL(baseUrl);
  const home = base.origin + base.pathname.replace(/\/$/, "");

  const scored = extractInternalLinks(html, baseUrl)
    .map((url) => ({ url, score: scorePath(new URL(url).pathname) }))
    .filter((c) => c.score > 0 && c.url !== home)
    .sort((a, b) => b.score - a.score);

  return [home, ...scored.slice(0, limit - 1).map((c) => c.url)];
}

/** Strips markup, script and style content, and collapses whitespace. */
export function htmlToText(html: string, maxChars = 15000): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
}

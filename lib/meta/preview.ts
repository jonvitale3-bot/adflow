/**
 * Meta's generatepreviews endpoint hands back a full `<iframe>` tag rather
 * than a URL. Its markup is never injected into the page — the src and the
 * dimensions it chose are read out, and the frame is rendered by us.
 */
export interface PreviewFrame {
  src: string;
  width: number;
  height: number;
}

// Each placement renders at its own aspect ratio. When Meta omits the size,
// a feed-ish portrait box beats a squashed frame.
const FALLBACK_WIDTH = 360;
const FALLBACK_HEIGHT = 640;

export function parsePreviewFrame(html: string | null): PreviewFrame | null {
  if (!html) return null;

  const src = /src="([^"]+)"/.exec(html)?.[1];
  if (!src) return null;

  return {
    // The tag is HTML, so its query separators arrive escaped.
    src: src.replace(/&amp;/g, "&"),
    width: Number(/width="(\d+)"/.exec(html)?.[1]) || FALLBACK_WIDTH,
    height: Number(/height="(\d+)"/.exec(html)?.[1]) || FALLBACK_HEIGHT,
  };
}

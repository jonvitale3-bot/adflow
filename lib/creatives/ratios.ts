/**
 * Aspect ratios, and which placements each one serves.
 *
 * Ads Manager asks for three uploads. In delivery terms it is really two:
 * feed placements want a square or 4:5, story and reels want 9:16. The
 * horizontal is worth having when someone supplies one — right column and
 * Audience Network prefer it — but no ad should wait on it.
 */

export type Ratio = "square" | "vertical" | "horizontal";

export const RATIOS: Ratio[] = ["square", "vertical", "horizontal"];

export const RATIO_LABELS: Record<Ratio, string> = {
  square: "Square",
  vertical: "Vertical",
  horizontal: "Horizontal",
};

/** What each is for, in the words someone briefing a designer would use. */
export const RATIO_HINTS: Record<Ratio, string> = {
  square: "1:1 or 4:5 — Facebook and Instagram feed",
  vertical: "9:16 — stories and reels",
  horizontal: "1.91:1 — right column and Audience Network",
};

// Feed images run from 4:5 (0.8) to a little past square. Anything meaningfully
// taller is a story asset; anything meaningfully wider is a banner.
const VERTICAL_BELOW = 0.8;
const HORIZONTAL_ABOVE = 1.2;

/**
 * Which bucket an image belongs to, from its dimensions.
 *
 * Classifying beats asking: the file already knows its shape, and a mislabelled
 * asset is worse than no asset — it sends a letterboxed square into the slot a
 * full-screen story was supposed to fill.
 */
export function ratioOf(width: number, height: number): Ratio {
  if (width <= 0 || height <= 0) return "square";
  const aspect = width / height;
  if (aspect < VERTICAL_BELOW) return "vertical";
  if (aspect > HORIZONTAL_ABOVE) return "horizontal";
  return "square";
}

export interface PlacementSpec {
  publisher_platforms: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  audience_network_positions?: string[];
  messenger_positions?: string[];
}

/**
 * The placements each ratio should serve.
 *
 * Kept deliberately narrow. A rule naming a position the ad set does not target
 * is fine; a rule naming a position Meta does not recognise fails the whole
 * creative, so this covers the placements these ads actually run in and lets
 * the default rule catch everything else.
 */
export const PLACEMENTS: Record<Ratio, PlacementSpec> = {
  square: {
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["feed"],
    instagram_positions: ["stream", "explore"],
  },
  vertical: {
    publisher_platforms: ["facebook", "instagram"],
    facebook_positions: ["story"],
    instagram_positions: ["story", "reels"],
  },
  horizontal: {
    publisher_platforms: ["facebook", "audience_network"],
    facebook_positions: ["right_hand_column"],
    audience_network_positions: ["classic"],
  },
};

/**
 * The ratio every unmatched placement falls back to.
 *
 * Meta requires one rule to be the default, and it has to be a shape that is
 * acceptable everywhere. Square is the only one that is.
 */
export const DEFAULT_RATIO: Ratio = "square";

/**
 * Which rendition serves each preview placement.
 *
 * The preview is the only place to check a per-placement asset before it runs,
 * so an Instagram story preview has to show the vertical, not the square it
 * would replace.
 */
export const PREVIEW_RATIOS: Record<string, Ratio> = {
  MOBILE_FEED_STANDARD: "square",
  DESKTOP_FEED_STANDARD: "square",
  INSTAGRAM_STANDARD: "square",
  INSTAGRAM_STORY: "vertical",
  FACEBOOK_STORY_MOBILE: "vertical",
};

/** The rendition a placement wants, falling back to the shape that fits anywhere. */
export function ratioForPreview(format: string): Ratio {
  return PREVIEW_RATIOS[format] ?? DEFAULT_RATIO;
}

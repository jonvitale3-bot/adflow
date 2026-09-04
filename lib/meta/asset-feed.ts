import { DEFAULT_RATIO, PLACEMENTS, RATIOS, type Ratio } from "../creatives/ratios.ts";

/**
 * Placement asset customization.
 *
 * This is the API form of what you do by hand in Ads Manager when you upload a
 * square, a vertical and a horizontal and assign each to placements. Instead of
 * `link_data` carrying one image, the creative carries an `asset_feed_spec`
 * whose images each hold an ad label, and a rule per label saying which
 * placements that image serves.
 *
 * One ad, several images, each delivered where it was designed to run — and no
 * machine cropping, which is the whole point when the image has copy on it.
 */

export interface RatioAsset {
  ratio: Ratio;
  imageHash: string;
}

export interface AssetFeedInput {
  assets: RatioAsset[];
  message: string;
  headline: string;
  link: string;
}

/** Ad labels have to be stable strings; the ratio name is already one. */
function labelFor(ratio: Ratio): string {
  return `ratio_${ratio}`;
}

/**
 * Builds the spec, or returns null when there is nothing to customize.
 *
 * Fewer than two assets means every placement would resolve to the same image,
 * which is the single-image path with more moving parts and more ways to be
 * rejected. Callers fall back to `link_data` on null.
 */
export function buildAssetFeedSpec(
  input: AssetFeedInput,
): Record<string, unknown> | null {
  // One asset per ratio, first wins, in the order Meta will be given them.
  const byRatio = new Map<Ratio, string>();
  for (const asset of input.assets) {
    if (!byRatio.has(asset.ratio)) byRatio.set(asset.ratio, asset.imageHash);
  }

  if (byRatio.size < 2) return null;

  // Every rule set needs a default, and it has to be a shape that renders in
  // any placement. Without a square there is no honest default, so the ad is
  // better served by the single-image path.
  const defaultHash = byRatio.get(DEFAULT_RATIO);
  if (!defaultHash) return null;

  const images = [...byRatio].map(([ratio, hash]) => ({
    hash,
    adlabels: [{ name: labelFor(ratio) }],
  }));

  // Order is priority: the first rule that claims a placement wins, and the
  // last rule is the fallback. Meta requires that fallback to exist and to
  // carry an EMPTY customization_spec — a rule that names placements and also
  // marks itself default is rejected with "Default Asset Customization Rule
  // (with lowest priority) with empty customization_spec is required".
  //
  // So the square is not given placements of its own. It is the default, which
  // is the same statement made the way Meta wants it heard: every placement no
  // other rule claimed renders with the square.
  const rules: Array<Record<string, unknown>> = [];

  for (const ratio of RATIOS) {
    if (ratio === DEFAULT_RATIO || !byRatio.has(ratio)) continue;
    rules.push({
      customization_spec: PLACEMENTS[ratio],
      image_label: { name: labelFor(ratio) },
    });
  }

  rules.push({
    customization_spec: {},
    image_label: { name: labelFor(DEFAULT_RATIO) },
    is_default: true,
  });

  return {
    ad_formats: ["SINGLE_IMAGE"],
    images,
    bodies: [{ text: input.message }],
    titles: [{ text: input.headline }],
    link_urls: [{ website_url: input.link }],
    call_to_action_types: ["LEARN_MORE"],
    asset_customization_rules: rules,
  };
}

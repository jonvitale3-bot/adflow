/**
 * Whether Meta may reframe a creative for each placement.
 *
 * Meta's placement adaptation turns one square into feed, story and reels by
 * cropping and extending it. That is a gift for a photograph and a defect for
 * a designed asset: cropping a 1:1 image to 9:16 removes most of its width,
 * which is where a headline runs and where an offer badge sits.
 *
 * So reframing is opt-in on evidence, not by default. An image is eligible
 * only once it has been examined and found to be a clean photograph — an
 * unexamined one is left alone. A letterboxed ad looks unpolished; an ad
 * cropped through its own price does not say the price.
 */
export function mayReframe(hasBakedText: boolean | null | undefined): boolean {
  return hasBakedText === false;
}

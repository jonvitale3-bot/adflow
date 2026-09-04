import "server-only";

import sharp from "sharp";

import { type Ratio } from "./ratios.ts";

/**
 * Building a missing aspect ratio from the one that exists.
 *
 * A designed creative cannot be cropped to another shape — the headline and
 * the offer badge are in the pixels the crop would take. So it is not cropped:
 * it is placed whole on a canvas of the target shape, over a blurred blow-up
 * of itself. Nothing is cut, and the frame is full rather than letterboxed.
 *
 * This is a fallback, not a substitute. A vertical laid out by a designer will
 * always beat one composed here. What it buys is that an ad with only a square
 * still fills a story slot, and that the square lands where a story's own
 * chrome is not sitting on top of it.
 */

export const TARGETS: Record<Ratio, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1200, height: 628 },
};

/**
 * Where the artwork sits vertically, as a fraction of the canvas.
 *
 * A story puts the profile row across the top and the call-to-action across
 * the bottom, so dead-centre is not the safe middle — the safe band runs from
 * roughly 14% to 80%, whose centre sits a little above halfway.
 */
const VERTICAL_ANCHOR = 0.45;

/** How much of the canvas width the artwork occupies. */
const INSET = 0.94;

export interface Extended {
  buffer: Buffer;
  width: number;
  height: number;
  /** Where the original artwork ended up, so callers can see what was done. */
  art: { left: number; top: number; width: number; height: number };
}

/**
 * Composes `source` onto a canvas of `ratio`, over a blurred fill of itself.
 *
 * The artwork is never scaled up past its own size: enlarging a 1080 square to
 * fill a 1920-tall frame would soften exactly the text this exists to protect.
 */
export async function extendToRatio(source: Buffer, ratio: Ratio): Promise<Extended> {
  const { width: canvasWidth, height: canvasHeight } = TARGETS[ratio];

  const meta = await sharp(source).metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Could not read the image's dimensions");
  }

  // Fit the artwork inside the canvas, leaving a margin, and never upscale.
  const maxWidth = Math.round(canvasWidth * INSET);
  const maxHeight = Math.round(canvasHeight * INSET);
  const scale = Math.min(maxWidth / meta.width, maxHeight / meta.height, 1);
  const artWidth = Math.max(1, Math.round(meta.width * scale));
  const artHeight = Math.max(1, Math.round(meta.height * scale));

  const art = await sharp(source)
    .resize(artWidth, artHeight, { fit: "inside" })
    .toBuffer();

  // The background covers the canvas and is blurred hard enough that no detail
  // in it competes with the artwork sitting on top.
  const background = await sharp(source)
    .resize(canvasWidth, canvasHeight, { fit: "cover", position: "centre" })
    .blur(40)
    .modulate({ brightness: 0.85 })
    .toBuffer();

  const anchor = ratio === "vertical" ? VERTICAL_ANCHOR : 0.5;
  const left = Math.round((canvasWidth - artWidth) / 2);
  // Clamped, so artwork taller than its safe band still lands on the canvas.
  const top = Math.min(
    Math.max(Math.round(canvasHeight * anchor - artHeight / 2), 0),
    Math.max(canvasHeight - artHeight, 0),
  );

  const buffer = await sharp(background)
    .composite([{ input: art, left, top }])
    // Meta rejects WebP outright, and JPEG keeps these well under the size cap.
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    buffer,
    width: canvasWidth,
    height: canvasHeight,
    art: { left, top, width: artWidth, height: artHeight },
  };
}

import assert from "node:assert/strict";
import { test } from "node:test";

import sharp from "sharp";

import { extendToRatio, TARGETS } from "./extend.ts";

/** A flat square, standing in for a designed creative. */
function square(size = 1080): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r: 20, g: 80, b: 160 } },
  })
    .jpeg()
    .toBuffer();
}

test("produces the target canvas for the ratio", async () => {
  const out = await extendToRatio(await square(), "vertical");
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.width, TARGETS.vertical.width);
  assert.equal(meta.height, TARGETS.vertical.height);
});

test("the artwork is placed whole — its aspect ratio is untouched", async () => {
  // A crop would change the shape. Nothing here may.
  const out = await extendToRatio(await square(900), "vertical");
  assert.equal(out.art.width, out.art.height);
});

test("the artwork lands fully inside the canvas", async () => {
  for (const ratio of ["vertical", "horizontal"] as const) {
    const out = await extendToRatio(await square(), ratio);
    assert.ok(out.art.left >= 0, `${ratio}: art starts left of the canvas`);
    assert.ok(out.art.top >= 0, `${ratio}: art starts above the canvas`);
    assert.ok(out.art.left + out.art.width <= out.width, `${ratio}: art runs off the right`);
    assert.ok(out.art.top + out.art.height <= out.height, `${ratio}: art runs off the bottom`);
  }
});

test("in a story the artwork sits above centre, clear of the call to action", async () => {
  const out = await extendToRatio(await square(), "vertical");
  const centre = (out.art.top + out.art.height / 2) / out.height;
  assert.ok(centre < 0.5, `centred at ${centre.toFixed(2)}; it should sit above halfway`);
  assert.ok(centre > 0.3, `centred at ${centre.toFixed(2)}; it should not hug the top`);
});

test("a small image is not blown up past its own resolution", async () => {
  // Upscaling would soften exactly the text this exists to protect.
  const out = await extendToRatio(await square(300), "vertical");
  assert.equal(out.art.width, 300);
  assert.equal(out.art.height, 300);
});

test("a wide image is fitted to the canvas rather than overflowing it", async () => {
  const wide = await sharp({
    create: { width: 2400, height: 1200, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();

  const out = await extendToRatio(wide, "vertical");
  assert.ok(out.art.width <= out.width);
  // Whole pixels, so 2:1 lands a rounding step either side of exact.
  assert.ok(Math.abs(out.art.width / out.art.height - 2) < 0.01);
});

test("the background fills the frame rather than leaving bars", async () => {
  const out = await extendToRatio(await square(), "vertical");
  const { data, info } = await sharp(out.buffer).raw().toBuffer({ resolveWithObject: true });

  // The top row is above the artwork, so it is background. Letterboxing would
  // leave it black or white; a filled frame carries the image's own colour.
  const [r, g, b] = [data[0]!, data[1]!, data[2]!];
  assert.ok(b > r, `top row is ${r},${g},${b} — expected the image's blue cast`);
  assert.equal(info.width, TARGETS.vertical.width);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAssetFeedSpec } from "./asset-feed.ts";

const COPY = {
  message: "Wet slips and dry racks at Bay Pines Marina.",
  headline: "Covered Dry Rack Boat Storage",
  link: "https://example.com/lp?utm_source=facebook",
};

test("one asset is not worth customizing", () => {
  assert.equal(
    buildAssetFeedSpec({ ...COPY, assets: [{ ratio: "square", imageHash: "a" }] }),
    null,
  );
});

test("without a square there is no shape that renders everywhere", () => {
  assert.equal(
    buildAssetFeedSpec({
      ...COPY,
      assets: [
        { ratio: "vertical", imageHash: "v" },
        { ratio: "horizontal", imageHash: "h" },
      ],
    }),
    null,
  );
});

test("each image carries a label, and each label has a rule", () => {
  const spec = buildAssetFeedSpec({
    ...COPY,
    assets: [
      { ratio: "square", imageHash: "sq" },
      { ratio: "vertical", imageHash: "vt" },
    ],
  })!;

  const images = spec.images as Array<{ hash: string; adlabels: [{ name: string }] }>;
  const rules = spec.asset_customization_rules as Array<{ image_label: { name: string } }>;

  assert.deepEqual(
    images.map((i) => i.adlabels[0].name).sort(),
    rules.map((r) => r.image_label.name).sort(),
  );
  assert.equal(images.length, 2);
});

test("the vertical serves stories and reels, the square serves feed", () => {
  const spec = buildAssetFeedSpec({
    ...COPY,
    assets: [
      { ratio: "square", imageHash: "sq" },
      { ratio: "vertical", imageHash: "vt" },
    ],
  })!;

  const rules = spec.asset_customization_rules as Array<{
    image_label: { name: string };
    customization_spec: { instagram_positions?: string[] };
  }>;

  const vertical = rules.find((r) => r.image_label.name === "ratio_vertical")!;
  assert.deepEqual(vertical.customization_spec.instagram_positions, ["story", "reels"]);
});

test("exactly one rule is the default, and it is the square", () => {
  const spec = buildAssetFeedSpec({
    ...COPY,
    assets: [
      { ratio: "vertical", imageHash: "vt" },
      { ratio: "square", imageHash: "sq" },
      { ratio: "horizontal", imageHash: "hz" },
    ],
  })!;

  const rules = spec.asset_customization_rules as Array<{
    image_label: { name: string };
    is_default?: boolean;
  }>;

  const defaults = rules.filter((r) => r.is_default);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0]!.image_label.name, "ratio_square");
});

test("a duplicate ratio does not produce two rules for one placement", () => {
  const spec = buildAssetFeedSpec({
    ...COPY,
    assets: [
      { ratio: "square", imageHash: "first" },
      { ratio: "square", imageHash: "second" },
      { ratio: "vertical", imageHash: "vt" },
    ],
  })!;

  const images = spec.images as Array<{ hash: string }>;
  assert.deepEqual(images.map((i) => i.hash), ["first", "vt"]);
});

test("copy travels with the assets, not beside them", () => {
  const spec = buildAssetFeedSpec({
    ...COPY,
    assets: [
      { ratio: "square", imageHash: "sq" },
      { ratio: "vertical", imageHash: "vt" },
    ],
  })!;

  assert.deepEqual(spec.bodies, [{ text: COPY.message }]);
  assert.deepEqual(spec.titles, [{ text: COPY.headline }]);
  assert.deepEqual(spec.link_urls, [{ website_url: COPY.link }]);
});

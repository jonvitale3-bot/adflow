import assert from "node:assert/strict";
import { test } from "node:test";

import { buildAssetFeedSpec } from "./asset-feed.ts";

const COPY = {
  message: "Wet slips and dry racks at Bay Pines Marina.",
  headline: "Covered Dry Rack Boat Storage",
  link: "https://example.com/lp?utm_source=facebook",
  hasInstagram: true,
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

test("the square is delivered by the default rule rather than named twice", () => {
  const spec = buildAssetFeedSpec({
    ...COPY,
    assets: [
      { ratio: "square", imageHash: "sq" },
      { ratio: "vertical", imageHash: "vt" },
    ],
  })!;

  const rules = spec.asset_customization_rules as Array<{ image_label: { name: string } }>;
  assert.equal(rules.filter((r) => r.image_label.name === "ratio_square").length, 1);
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

test("the default rule is last, is the square, and claims no placements", () => {
  // Meta rejects a creative whose default rule names placements:
  // "Default Asset Customization Rule (with lowest priority) with empty
  // customization_spec is required". Order is priority, so it must also be
  // last or it would swallow the rules after it.
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
    customization_spec: Record<string, unknown>;
    is_default?: boolean;
  }>;

  const defaults = rules.filter((r) => r.is_default);
  assert.equal(defaults.length, 1);

  const fallback = rules.at(-1)!;
  assert.equal(fallback.is_default, true);
  assert.equal(fallback.image_label.name, "ratio_square");
  assert.deepEqual(fallback.customization_spec, {});
});

test("no rule other than the default is left without placements", () => {
  const spec = buildAssetFeedSpec({
    ...COPY,
    assets: [
      { ratio: "square", imageHash: "sq" },
      { ratio: "vertical", imageHash: "vt" },
    ],
  })!;

  const rules = spec.asset_customization_rules as Array<{
    customization_spec: Record<string, unknown>;
    is_default?: boolean;
  }>;

  for (const rule of rules.slice(0, -1)) {
    assert.ok(!rule.is_default, "only the last rule may be the default");
    assert.ok(
      Object.keys(rule.customization_spec).length > 0,
      "a non-default rule with no placements would claim everything",
    );
  }
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

test("a client with no Instagram gets no Instagram placement", () => {
  // Meta refuses a creative that claims to run somewhere the advertiser has
  // nobody to run as: "Select an Instagram account or a Facebook Page to
  // represent your business on Instagram."
  const spec = buildAssetFeedSpec({
    ...COPY,
    hasInstagram: false,
    assets: [
      { ratio: "square", imageHash: "sq" },
      { ratio: "vertical", imageHash: "vt" },
    ],
  })!;

  const rules = spec.asset_customization_rules as Array<{
    customization_spec: { publisher_platforms?: string[]; instagram_positions?: string[] };
  }>;

  for (const rule of rules) {
    assert.ok(!rule.customization_spec.publisher_platforms?.includes("instagram"));
    assert.equal(rule.customization_spec.instagram_positions, undefined);
  }
});

test("the vertical still serves Facebook stories without Instagram", () => {
  const spec = buildAssetFeedSpec({
    ...COPY,
    hasInstagram: false,
    assets: [
      { ratio: "square", imageHash: "sq" },
      { ratio: "vertical", imageHash: "vt" },
    ],
  })!;

  const rules = spec.asset_customization_rules as Array<{
    image_label: { name: string };
    customization_spec: { facebook_positions?: string[] };
  }>;

  const vertical = rules.find((r) => r.image_label.name === "ratio_vertical");
  assert.ok(vertical, "the vertical rule was dropped entirely");
  assert.deepEqual(vertical.customization_spec.facebook_positions, ["story"]);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { bankFor, selectScenes, BOAT_CLUB_SCENES } from "./scenes.ts";
import { buildImagePrompt } from "./templates.ts";

const base = { clientName: "Test Club", industry: "boat_club" };

test("scene text is preserved verbatim — it encodes real failures", () => {
  // Spot-check the constraints that were hardest won.
  assert.match(BOAT_CLUB_SCENES.cruising!, /V-shaped wake/);
  assert.match(BOAT_CLUB_SCENES.cruising!, /at least 200 yards away/);
  assert.match(BOAT_CLUB_SCENES.cruising!, /NO coolers, bags, towels/);
  assert.match(BOAT_CLUB_SCENES.fun!, /Absolutely no jumping near a dock/);
});

test("bankFor routes industry and marina subtype", () => {
  assert.equal(bankFor("boat_club"), BOAT_CLUB_SCENES);
  assert.ok(bankFor("marina", "wet_slips"));
  // A marina with no subtype has no bank — which is why the form requires one.
  assert.equal(bankFor("marina", null), null);
  assert.equal(bankFor("med_spa"), null);
});

test("a named scene is used for every image in the batch", () => {
  const scenes = selectScenes(BOAT_CLUB_SCENES, "fishing", 4);
  assert.equal(scenes.length, 4);
  assert.ok(scenes.every((s) => s.id === "fishing"));
});

test("mixed uses every scene once before repeating any", () => {
  // The original picked each image's scene independently with a random offset,
  // so a batch of 6 regularly contained duplicates.
  const bank = BOAT_CLUB_SCENES;
  const size = Object.keys(bank).length;
  const scenes = selectScenes(bank, "mixed", size);
  assert.equal(new Set(scenes.map((s) => s.id)).size, size, "a full pass must be distinct");
});

test("mixed beyond the bank size wraps into a fresh permutation", () => {
  const size = Object.keys(BOAT_CLUB_SCENES).length;
  const scenes = selectScenes(BOAT_CLUB_SCENES, "mixed", size + 2);
  assert.equal(scenes.length, size + 2);
  // Every scene appears at least once.
  assert.equal(new Set(scenes.slice(0, size).map((s) => s.id)).size, size);
});

test("the no-chrome instruction survives in every industry", () => {
  for (const industry of ["boat_club", "marina", "med_spa", "insurance"]) {
    const p = buildImagePrompt({ ...base, industry });
    assert.match(p, /PHOTOGRAPH ONLY/, industry);
    assert.match(p, /DO NOT render any text/, industry);
    assert.match(p, /DO NOT render any button/, industry);
  }
});

test("realism and anatomy rules apply to every industry, not just boat clubs", () => {
  const medspa = buildImagePrompt({ ...base, industry: "med_spa" });
  assert.match(medspa, /STRICT REALISM RULES/);
  assert.match(medspa, /ANATOMY RULES/);
  // Jumping rules are boat-specific and should not leak.
  assert.doesNotMatch(medspa, /JUMPING \/ ACTIVITY RULES/);
  assert.match(buildImagePrompt(base), /JUMPING \/ ACTIVITY RULES/);
});

test("the phone register asks for real light and forbids faked artifacts", () => {
  const p = buildImagePrompt({ ...base, camera: "phone" });
  assert.match(p, /real photo someone actually took on their phone/);
  assert.match(p, /No studio lighting/);
  // Simulating a phone photo is the failure mode, not the goal.
  assert.match(p, /no added grain, no fake lens flare/);
});

test("camera register is swappable for A/B testing", () => {
  const phone = buildImagePrompt({ ...base, camera: "phone" });
  const dslr = buildImagePrompt({ ...base, camera: "dslr" });
  assert.notEqual(phone, dslr);
  assert.match(dslr, /35mm lens/);
  assert.doesNotMatch(phone, /35mm lens/);
});

test("composition keeps overlay space but is no longer Carefree-specific", () => {
  const p = buildImagePrompt({ ...base, industry: "insurance" });
  assert.match(p, /UPPER-LEFT quadrant visually calm/);
  assert.match(p, /BOTTOM ~20%/);
  // The original named a navy CTA strip, which is meaningless for other clients.
  assert.doesNotMatch(p, /navy/i);
});

test("the headline is passed for context and explicitly not rendered", () => {
  const p = buildImagePrompt({ ...base, headline: "Your Boat Is Waiting" });
  assert.match(p, /provided for context ONLY/);
  assert.match(p, /do NOT render it in the image/);
});

test("scene text reaches the prompt when supplied", () => {
  const p = buildImagePrompt({ ...base, sceneText: BOAT_CLUB_SCENES.cruising });
  assert.match(p, /V-shaped wake/);
});

test("a multi-service marina draws scenes from every service it offers", () => {
  const single = bankFor("marina", ["boat_rentals"]);
  const multi = bankFor("marina", ["boat_rentals", "wet_slips"]);

  assert.ok(single && multi);
  assert.ok(
    Object.keys(multi!).length > Object.keys(single!).length,
    "adding a service must add its scenes",
  );

  // Ids are namespaced, because several banks define "dock_walk".
  assert.ok(Object.keys(multi!).every((id) => id.includes(":")));
  assert.ok(Object.keys(multi!).some((id) => id.startsWith("boat_rentals:")));
  assert.ok(Object.keys(multi!).some((id) => id.startsWith("wet_slips:")));
});

test("a single-service marina keeps plain scene ids", () => {
  const bank = bankFor("marina", ["wet_slips"]);
  assert.ok(bank && Object.keys(bank).every((id) => !id.includes(":")));
});

test("a marina with no service still has no scenes", () => {
  assert.equal(bankFor("marina", []), null);
  assert.equal(bankFor("marina", null), null);
});

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
  // Asserts the requirement, not the wording: this used to be seven bullets at
  // the very front of the prompt and is now one line at the back.
  for (const industry of ["boat_club", "marina", "med_spa", "insurance"]) {
    const p = buildImagePrompt({ ...base, industry });
    assert.match(p, /NO TEXT OR GRAPHICS/, industry);
    assert.match(p, /No text, letters, numbers or typography/, industry);
    assert.match(p, /no buttons, banners or UI/, industry);
  }
});

test("the picture comes before the rules that qualify it", () => {
  // The whole point of the rewrite. The old prompt spent its first 900
  // characters forbidding text and did not describe the photograph until
  // character 1,965, by which point the model had stopped listening.
  const p = buildImagePrompt({
    ...base,
    sceneText: "Kneeling to swap a sediment cartridge, old one on newspaper beside him.",
    framingText: "Close on the hands, from about arm's length.",
  });

  assert.ok(p.indexOf("Kneeling to swap") < 120, "the scene must open the prompt");
  assert.ok(
    p.indexOf("Close on the hands") < p.indexOf("ANATOMY RULES"),
    "framing must precede the hard rules",
  );
  assert.ok(
    p.indexOf("NO TEXT OR GRAPHICS") > p.indexOf("PHOTOGRAPHIC CHARACTER"),
    "chrome rules belong in the tail",
  );
});

test("nobody is presenting anything to the camera", () => {
  // Every image in the batch that triggered this was a man holding a part up
  // for the lens, which is the stock-photo read that survived every other fix.
  const p = buildImagePrompt({ ...base, industry: "home_services" });
  assert.match(p, /THIS IS NOT A DEMONSTRATION/);
  assert.match(p, /Nobody is aware of the camera/);
});

test("the prompt stays short enough that its front matter is the picture", () => {
  const p = buildImagePrompt({
    ...base,
    industry: "home_services",
    sceneText: "Kneeling to swap a sediment cartridge.",
    framingText: "Close on the hands.",
  });
  // 4,251 characters was the version that produced six unusable images, and
  // most of that length sat in front of the picture.
  assert.ok(p.length < 3200, `prompt is ${p.length} chars, back to a wall of rules`);
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

test("overlay space is reserved only when something will be overlaid", () => {
  // These rules pin the subject right of centre, keep two areas of the frame
  // empty and forbid cropping tight. Applied to every image they are a large
  // part of why a batch came back looking like one photograph repeated.
  const off = buildImagePrompt({ ...base, industry: "insurance" });
  assert.doesNotMatch(off, /UPPER-LEFT quadrant visually calm/);

  const on = buildImagePrompt({ ...base, industry: "insurance", reserveOverlaySpace: true });
  assert.match(on, /UPPER-LEFT quadrant visually calm/);
  assert.match(on, /BOTTOM ~20%/);
  // The original named a navy CTA strip, which is meaningless for other clients.
  assert.doesNotMatch(on, /navy/i);
});

test("boat rules go to boats, not to everyone", () => {
  // A water treatment ad was carrying a paragraph about wakes, gunwales, swim
  // platforms and outboard motors.
  const plumber = buildImagePrompt({ ...base, industry: "home_services" });
  assert.doesNotMatch(plumber, /gunwale|swim platform|outboard|wake/i);
  assert.match(plumber, /STRICT REALISM RULES/);

  const club = buildImagePrompt({ ...base, industry: "boat_club" });
  assert.match(club, /BOATING REALISM RULES/);
  assert.match(club, /gunwale/i);
});

test("the framing for this shot reaches the prompt", () => {
  const p = buildImagePrompt({
    ...base,
    framingText: "Close on the hands and what they are working on.",
  });
  assert.match(p, /HOW THIS SHOT IS FRAMED/);
  assert.match(p, /Close on the hands/);
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

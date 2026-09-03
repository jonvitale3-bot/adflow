/**
 * Scene banks — PORTED VERBATIM from the Lovable build.
 *
 * This text is the most valuable and least reproducible part of the image
 * pipeline. Each constraint records a failure observed in real output: coolers
 * balanced where they would fall overboard, boats labelled "cruising" tied to
 * a dock, wakes behind anchored boats, people airborne beside dock pilings.
 *
 * Do not paraphrase, tidy, or shorten these. Changing them is a product
 * decision that needs its output reviewed.
 */

export const BOAT_CLUB_SCENES: Record<string, string> = {
  fun: "high-energy fun moment — people cannonballing or jumping into OPEN WATER from the boat, swimmers laughing, kids on tubes, friends splashing each other. Energetic but not chaotic. Absolutely no jumping near a dock.",
  cruising:
    "boat actively underway across OPEN water with a clear V-shaped wake trailing behind the stern and visible bow spray — boat is clearly moving, not parked. Captain at the helm hands on the wheel, passengers seated facing forward, hair gently catching the wind. Shoreline is distant (at least 200 yards away). NO dock, NO pier, NO pilings, NO other boats nearby, NO swimmers in the water. NO coolers, bags, towels, or loose objects sitting on the swim platform, rear deck edge, or anywhere they could fall overboard — all gear stowed inside the seating area. Peaceful golden light.",
  fishing:
    "early morning fishing scene — 2–3 anglers (dad + kids or two friends) with fishing rods on the boat, glassy calm water, soft pastel sunrise sky, tackle box visible, quiet focused mood, no swimming",
  sunset:
    "golden hour anchored hang — boat anchored in calm water with the sun low on the horizon, adults relaxing with drinks in hand, warm orange/pink sky reflections on the water, social and chill mood, no jumping",
  family:
    "wholesome family day on the water — mom, dad, and 2 kids on the boat, one parent helping a child swim alongside in calm water, towels and snacks visible, bright happy daylight, warm family bond",
  sandbar:
    "social sandbar raft-up — boat anchored in shallow clear water near a sandbar, a few people standing waist-deep in the water beside the boat chatting, cooler on the boat, bright midday sun, vacation vibe, no dock in scene",
  watersports:
    "active watersports moment — one person tubing or wakeboarding behind the boat with a clean white spray trail, driver looking back smiling, passenger spotting, open water, dynamic motion, no dock in scene",
};

export const BOAT_RENTAL_SCENES: Record<string, string> = {
  arrival:
    "small group of friends or a young family walking down the dock toward a clean rental pontoon, life jackets in hand, excited body language, sunny midday, no club branding visible",
  cruising:
    "rental pontoon actively underway mid-lake with a clear V-shaped wake behind the stern and visible bow spray — boat is clearly in motion, not parked or drifting near a dock. Low water-level camera angle, small group seated on board facing forward, forested shoreline at least 200 yards in the distance. NO dock, pier, pilings, or other boats in frame. NO coolers, bags, towels, or loose gear on the swim platform or rear deck edge — everything stowed inside the seating area. Sparkling open water, faces not close enough to identify.",
  family_day:
    "family of 4 enjoying a half-day pontoon rental anchored in calm open water away from any dock. Cooler and towels neatly placed INSIDE the seating area (never on the swim platform, rear deck edge, or anywhere they could slide overboard). Bright summer light, candid not posed.",
  sandbar:
    "rental boat anchored near a sandbar, riders wading in shallow turquoise water, vacation energy, no dock visible in frame",
  sunset_cruise:
    "rental boat actively cruising into golden-hour light with a visible wake trailing the stern, silhouettes of 2-3 seated riders facing forward, warm orange water reflections, peaceful end-of-day mood, NO dock or pier in frame, NO loose gear on rear deck.",
  dock_lineup:
    "wide shot of a clean rental dock with a row of well-maintained pontoons ready to go, late morning light, no people in frame — inventory hero shot",
};

export const WET_SLIP_SCENES: Record<string, string> = {
  aerial:
    "aerial drone shot of a full marina at golden hour, neat rows of boats in wet slips, calm protected water, surrounding shoreline, premium feel",
  dock_walk:
    "long marina dock at sunrise lined with boats in slips, soft mist on the water, owner walking down the dock with a coffee, peaceful private-club mood",
  sunset_slip:
    "boat tied in its slip at sunset, dock lines clean and taut, warm sky reflecting on glassy harbor water, lifestyle ownership feel",
  protected_harbor:
    "wide shot of a protected harbor full of boats in wet slips during a calm evening, lit dock posts beginning to glow, secure premium marina feel",
};

export const DRY_STORAGE_SCENES: Record<string, string> = {
  rack_hero:
    "interior of a clean modern dry-stack storage building, multiple boats neatly racked on tiers, forklift visible in background, organized industrial-premium look",
  forklift_launch:
    "marina forklift lowering a boat into the water at a launch well, operator in branded polo, customer waiting on the dock, professional service moment",
  yard_aerial:
    "aerial view of a clean dry-storage boat yard with rows of trailered and racked boats, organized lot, blue sky",
  ready_to_launch:
    "single boat freshly placed in the water at the launch ramp after dry-storage retrieval, dripping water, ready for the owner to step on, sunny morning",
};

export const STORAGE_SLIPS_SCENES: Record<string, string> = {
  marina_aerial:
    "aerial overview of a full-service marina at golden hour — wet slips in the foreground, dry-stack building and trailered storage yard behind, clean and organized",
  slip_lifestyle:
    "boat owner stepping off their boat onto the slip dock at sunset, coffee in hand, relaxed weekend vibe, marina in background",
  rack_to_water:
    "forklift moving a boat from the dry-stack rack toward the launch well, smooth service operation, mid-morning light",
  dock_walk:
    "wide dock walk shot showing slips on one side and the storage facility behind, premium and secure feel",
};

export const FULL_SERVICE_SCENES: Record<string, string> = {
  fuel_dock:
    "boat pulling up to a clean marina fuel dock, attendant in branded polo greeting the captain, gleaming pumps, sunny midday",
  service_bay:
    "professional marine technician working on a boat engine in a clean, well-lit service bay, tools organized, premium service feel — no close-up faces",
  ship_store:
    "warm interior of a marina ship store with apparel, gear and accessories neatly merchandised, soft natural light from windows facing the water",
  marina_hero:
    "wide hero shot of a full-service marina at golden hour — slips, fuel dock, service building and storefront all visible, well-kept and busy but not crowded",
};

export const SCENE_BANK: Record<string, Record<string, string>> = {
  boat_club: BOAT_CLUB_SCENES,
  boat_rentals: BOAT_RENTAL_SCENES,
  wet_slips: WET_SLIP_SCENES,
  dry_storage: DRY_STORAGE_SCENES,
  storage_slips: STORAGE_SLIPS_SCENES,
  full_service: FULL_SERVICE_SCENES,
};

/** Which bank applies, or null when the industry has no scenes. */
export function bankFor(industry: string, marineBusinessType?: string | null) {
  if (industry === "boat_club") return SCENE_BANK.boat_club!;
  if (industry === "marina" && marineBusinessType && SCENE_BANK[marineBusinessType]) {
    return SCENE_BANK[marineBusinessType]!;
  }
  return null;
}

/**
 * Picks scenes for a batch.
 *
 * The original computed each image's scene independently as
 * `ids[(idx - 1 + floor(random * len)) % len]`, so "mixed" regularly produced
 * duplicates — you asked for six varied images and got the same scene three
 * times. This deals a shuffled deck instead, so a batch uses every scene once
 * before repeating any.
 */
export function selectScenes(
  bank: Record<string, string>,
  sceneId: string | undefined,
  count: number,
  random: () => number = Math.random,
): Array<{ id: string; text: string }> {
  const ids = Object.keys(bank);

  if (sceneId && sceneId !== "mixed" && bank[sceneId]) {
    return Array.from({ length: count }, () => ({ id: sceneId, text: bank[sceneId]! }));
  }

  const out: Array<{ id: string; text: string }> = [];
  while (out.length < count) {
    const deck = [...ids];
    // Fisher-Yates, so each pass through the deck is a fresh permutation.
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    for (const id of deck) {
      if (out.length >= count) break;
      out.push({ id, text: bank[id]! });
    }
  }
  return out;
}

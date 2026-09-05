/**
 * Physical plausibility, for any client.
 *
 * The block below it is about boats. This one is about whether a photograph
 * could have been taken, which is true of a water softener in a basement as
 * much as of a boat on open water.
 */
export const UNIVERSAL_REALISM = `

STRICT REALISM RULES (these override anything above if there is a conflict):
- Physical plausibility: every object is where someone doing this work would actually put it. Tools, parts, packaging and rags belong on the floor, on a bench, or in a hand, never balanced somewhere they would fall from.
- The scene must match the task. If someone is testing water, there is a sample and something to read it with. If a part is being replaced, the old one is somewhere in the frame.
- Real places are not showrooms. Existing pipework, older fittings, a water stain, stored boxes, an uneven floor. The space belongs to the customer and was not tidied for a photograph.
- No AI artifacts: no extra fingers, warped faces, melted hardware, impossible reflections, duplicated fittings, or floating objects. Equipment must be structurally correct and plausibly plumbed or wired.
- No on-image text, no logos, no watermarks, no UI elements, no fake review stars.`;

/**
 * Marine-specific plausibility — PORTED VERBATIM.
 *
 * Sent only to boat clubs and marinas. It was going to every client, so a
 * water treatment ad carried a paragraph about wakes, gunwales, swim platforms
 * and outboard motors, which is at best noise in the prompt.
 */
export const MARINE_REALISM = `

BOATING REALISM RULES (these override anything above if there is a conflict):
- Every object in the scene must be where a real boater would actually put it. Coolers, bags, towels, fishing rods, drinks, and other loose gear belong INSIDE the seating area or on the floor between seats — NEVER balanced on the swim platform, rear deck edge, gunwale, or bow tip where they would fall overboard.
- Boat state must match the scene verb. If the scene says "cruising" or "underway", the boat must show a clear V-shaped wake behind the stern, visible bow spray, and the outboard motor must be DOWN in the water and running. If the scene says "anchored" or "docked", the wake must be ABSENT and water around the hull must be calm.
- Scene exclusivity: if a scene says "no dock", there must be no dock, pier, pilings, mooring posts, dock cleats, dock lines, or boat lifts anywhere in frame — including the background. If it says "open water", the nearest shoreline must read as distant.
- People must be in poses that match the activity. Driving = hands on the wheel facing forward. Cruising passengers = seated, not standing on the bow at speed. Swimming = only when scene calls for it AND the boat is anchored.
- All boat hardware (railings, cleats, motor, bimini frame) must be structurally correct and consistent on both sides.`;

/**
 * Anatomy rules, lifted from the live master prompt so every industry gets
 * them rather than boat clubs alone.
 */
export const ANATOMY_CONSTRAINTS = `

ANATOMY RULES (CRITICAL — these are hard requirements):
- Every person must have EXACTLY two arms, two legs, one head, and five fingers per hand
- NO duplicated, overlapping, ghosted, or extra limbs of any kind
- NO extra body parts emerging from clothing, water, or other people
- Natural human proportions — no distorted faces, melted features, or fused bodies
- Hands must be fully formed and visible or clearly tucked away — never half-formed or mangled
- If a person is partially obscured, the obscured limbs simply do not appear (do not invent extra ones)
- Keep the number of people small. Most scenes need one or two; never more than five.`;

/** Boat-club specific. Jumping near a dock was a recurring failure. */
export const JUMPING_CONSTRAINTS = `

JUMPING / ACTIVITY RULES:
- Jumping or cannonballing INTO OPEN WATER from the boat is encouraged — it adds fun, energetic, candid energy
- ABSOLUTELY NO jumping off a dock, jumping near a dock, jumping over dock structures, or any mid-air pose adjacent to wooden dock planks
- If a dock is present in the scene, no person may be airborne anywhere near it — docks are for walking on or boarding the boat from, never for jumping
- People in the water should be swimming, wading, floating on tubes, or surfacing from a clean jump in open water — never next to dock pilings`;

/**
 * Composition that leaves room for chrome laid over the photo afterwards.
 *
 * No longer sent by default, and that is the point. It pins the subject to the
 * right of centre, keeps the upper-left and bottom fifth empty, and forbids
 * cropping tight — one recipe, applied to every image of every batch, which is
 * a large part of why six photographs came back looking like one.
 *
 * It exists for a compositing step that no longer runs: Cloudinary stamped the
 * bar and pill, and the creative that actually runs now arrives from a
 * designer with its headline already in place. So it is opt-in, for the case
 * where something really will be overlaid.
 */
export const COMPOSITION_CONSTRAINTS = `

COMPOSITION (still a pure photograph — never render the overlay itself):
- Keep the UPPER-LEFT quadrant visually calm (open sky, soft water, distant background) so a headline can be overlaid later. No critical subject matter in the upper-left.
- Keep the BOTTOM ~20% of the frame relatively calm — no faces, no key action. A call-to-action strip is composited over this area in code. Do NOT paint a bar or block of colour yourself; leave natural scenery so the overlay reads cleanly.
- Main subject belongs in the right-centre / lower-right portion of the frame.
- Wide framing with environmental context visible. Do not crop tight.`;

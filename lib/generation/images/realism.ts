/**
 * Hard rules, kept deliberately short.
 *
 * These used to run to thousands of characters of prohibitions and sat at the
 * front of every prompt, ahead of any description of the actual picture. The
 * model obeyed them perfectly (no text appeared in any image) and had almost
 * no signal left for what the photograph should look like. They are now a
 * compact tail after the scene, not a wall in front of it.
 */
export const UNIVERSAL_REALISM = `
STRICT REALISM RULES (these override anything above if there is a conflict):
- Physical plausibility: objects rest where gravity and the work would put them. Nothing balanced where it would fall, nothing floating, no impossible reflections.
- The scene matches the task. Testing water means a sample and something to read it with; replacing a part means the old one is somewhere in frame.
- Real places are not showrooms. Existing pipework, older fittings, a water stain, stored boxes, an uneven floor. The space belongs to the customer and was not tidied for a photograph.
- Equipment is structurally correct and plausibly plumbed or wired.`;

/**
 * The tell that survived every other fix.
 *
 * Six images came back and every one was a man presenting a component to the
 * lens: holding up a membrane, aiming a wrench, pointing at a valve. That is
 * the stock-photo read, and nothing in the prompt forbade it. The scene block
 * arguably invited it by asking for the activity to be "the centrepiece".
 */
export const NOT_A_DEMONSTRATION = `
THIS IS NOT A DEMONSTRATION:
- Nobody is presenting anything to the camera, holding a part up for the lens, gesturing at equipment for the viewer's benefit, or pointing at something to explain it.
- Nobody is aware of the camera. No eye contact, no posing, no arranged groups.
- The work is simply happening and the camera happened to be there. If the photograph were cropped differently it would still make sense.`;

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
 * Anatomy, compressed from seven bullets to two lines.
 *
 * Seven bullets did not buy seven bullets' worth of correct hands; it bought
 * length in the part of the prompt that crowds out the picture.
 */
export const ANATOMY_CONSTRAINTS = `
ANATOMY RULES (CRITICAL — hard requirements):
- Every person has exactly two arms, two legs, one head, five fingers per hand. No duplicated, ghosted, floating or extra limbs, no limbs emerging from clothing or from other people, no distorted or melted faces. Hands are either fully formed or clearly out of frame, never half-formed.
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
 * Not sent by default, and that is the point. It pins the subject to the right
 * of centre, keeps the upper-left and bottom fifth empty, and forbids cropping
 * tight — one recipe, applied to every image of every batch.
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

/**
 * The whole no-chrome instruction, in one line instead of seven bullets.
 *
 * Seven bullets of it opened every prompt and consumed the span an image model
 * weights most heavily. It was never the failing instruction: not one of the
 * six images that prompted this rewrite contained any text at all.
 */
export const NO_CHROME = `
NO TEXT OR GRAPHICS: output a clean full-bleed photograph and nothing else. No text, letters, numbers or typography anywhere in the image, no logos or wordmarks, no buttons, banners or UI, no icons, no coloured bars or blocks across the top or bottom. The headline, logo and call-to-action are composited over this photo in code afterwards.`;

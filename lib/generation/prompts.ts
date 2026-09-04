/**
 * Ad copy system prompts.
 *
 * PORTED VERBATIM from the Lovable build. Every ban and rule in here was
 * arrived at by iterating against real ad output, see docs/SPEC.md §6 and §9.
 * The phrasing is load-bearing: rewording a ban weakens it. Treat any edit as
 * a product decision that needs its output reviewed, not a refactor.
 */

import { buildPromoSection, buildSeasonalSection, type SeasonType } from "./season.ts";

export interface BrandContext {
  brandVoice?: string | null;
  keyPhrases?: string | null;
  neverSay?: string | null;
  adExamples?: string | null;
}

export interface CopyPromptInput {
  clientName: string;
  locationDescription: string;
  industry: string;
  seasonType: SeasonType;
  currentPromotion?: string | null;
  businessTypeDescription?: string | null;
  offerDescription?: string | null;
  toneKeywords?: string | null;
  brand: BrandContext;
  count: number;
  timeZone: string;
  now?: Date;
  /**
   * What each variation's image depicts, in order. When present the copy is
   * written to the photo it will run with rather than paired blind.
   */
  pairedImages?: Array<string | null>;
}

const DEFAULT_BOAT_CLUB_VOICE = `
BRAND VOICE:
- Aspirational but accessible: boating should feel achievable, not exclusive
- Effortless and hassle-free: the core promise is all the joy with none of the ownership headaches
- Warm, active, lifestyle-forward: families, friends, weekends, memories
- Never corporate or stiff, conversational but polished
- Key brand phrases to draw from: 'We make boating easy. You make it unforgettable', 'All the best parts of boating', 'No maintenance. No slip fees. No stress. Just fun.'
`;

/**
 * Brand context is now per-client. The old build applied one global row to
 * every client and labelled it "CAREFREE BRAND VOICE" regardless of who the
 * client was (docs/SPEC.md §9 rule 25). The label is now the client's brand.
 */
export function buildBrandContext(brand: BrandContext, brandLabel: string): string {
  let out = "";
  const label = brandLabel.trim().toUpperCase() || "CLIENT";

  if (brand.brandVoice) {
    out += `\n${label} BRAND VOICE:\n${brand.brandVoice.slice(0, 2000)}\n`;
  }
  if (brand.keyPhrases) {
    out += `\nKEY BRAND PHRASES TO REFERENCE:\n${brand.keyPhrases}\n`;
  }
  if (brand.neverSay) {
    out += `\nNEVER USE THESE WORDS OR CLAIMS:\n${brand.neverSay}\n`;
  }
  if (brand.adExamples) {
    out += `\nEXAMPLE ADS THAT REPRESENT THE IDEAL STYLE, write in this voice:\n${brand.adExamples}\n`;
  }

  return out;
}

const LENGTH_RULES = `LENGTH, a constraint, not a style:

Meta collapses the primary text behind "... more" after roughly two lines on mobile. Everything past that is read only by someone who already decided to keep reading, so the opening has to earn the expansion on its own.

- The first sentence or two must work alone. If they do not, nothing else in the ad gets read.
- Keep the whole primary text under 90 words. Under 60 is usually stronger.
- Three short paragraphs separated by blank lines; four at the most.

PUNCTUATION, absolute, and not a preference to be weighed against anything else:

- NEVER use an em dash (—) or an en dash (–). Not as a pause, not around an aside, not to join two thoughts. There is no ad in which one is acceptable. Where a sentence seems to want one, it needs a comma, a full stop, or rewriting. Check the copy for these characters before returning it.
- No exclamation marks.
- One emoji in the entire ad, on the call to action.`;

const VOICE_RULES = `HOW IT SHOULD READ. This is the part most ad copy gets wrong.

The common failure is copy that satisfies every rule and still reads like a list with the bullets taken off:

  Storing a boat should not be a second hobby.
  Covered dry-stack racks at Bay Pines Marina, St. Petersburg.

  Boat stays shaded and clean. Launch when you call ahead.
  No bottom growth. No driveway. No trailer upkeep.

  Racks and wet slips both sit on Boca Ciega Bay.

Every sentence there is the same length and the same shape, and none of them connect, and nothing carries forward from one to the next. That is six separate claims sitting next to each other, not an ad.

The same material, written as an ad:

  Owning a boat in Florida means half your weekends go to the boat instead of to the water.

  At Bay Pines it sits on a covered rack, so nothing grows on the hull and nothing bakes in the sun. Call ahead and it is down and floating by the time you park, with no trailer to hitch and no driveway to give up.

  Racks and wet slips, both right on Boca Ciega Bay.

  👇 Reserve rack space for the season

What makes the difference:
- ONE argument per ad. Decide what this ad is saying before you write it, and say only that. Four unrelated claims stacked up is the failure above.
- Vary sentence length. A longer sentence that carries an idea, then a short one that lands it. When every sentence runs the same length the ad reads like a list no matter what it says.
- Connect the ideas. Use "so", "and", "but", and commas: anything that lets one thought lead into the next. Do not give every clause its own full stop.
- Write to one person, in the second person, the way you would explain it to someone standing in front of you.
- The close pays off the opening. If the first line names a problem, the last line should answer it.
- Specifics beat adjectives every time. One real detail about this business is worth more than "premium", "hassle-free" or "world-class".`;

const SHAPE_RULES = `SHAPE, not a form. Do not fill in slots.

Paragraph 1: open on something true and specific: a situation the reader will recognise, or a plain statement of what this is. Most people see only this.

Paragraph 2: the substance. What they actually get, concretely, and what they stop having to deal with. Real sentences, not a run of clipped phrases.

Paragraph 3: one concrete detail or the current offer, then the call to action on its own line.

If an ad is better as two paragraphs, write two. What must not happen is every ad arriving with the same skeleton.`;

const VARIETY_RULES = `VARIETY. These run together in one ad set, so they must not read as one ad rewritten.

Vary the opening move itself, not just the wording: one can open on a problem, another on a plain description of what this is, another on something a customer would actually say, another mid-thought. If two ads open the same way, rewrite one of them.`;

const CTA_RULES = ` CTA RULES (CRITICAL, these override everything else for the CTA line):
 - NEVER use the words "click", "tap", "instant access", "learn more" (as a verb), or "act now" in the CTA line.
 - NEVER say "Click Learn More" or "Hit Learn More". Meta penalizes this and it sounds robotic.
 - The CTA should describe what the user will GET or DO next, with a clear action-driven verb that creates real urgency.
 - Lead with strong action verbs: "Join", "Claim", "Reserve", "Grab", "Lock in", "Secure", "Start", "Get". Membership/season-driven urgency is encouraged ("before summer", "this season", "this week", "spots filling").
 - Good CTAs: "👇 Join now before summer fills up", "Claim your spot this season 👇", "👇 Reserve your home marina today", "Lock in membership this week 👇", "👇 Start boating this weekend", "Grab a spot before the season starts 👇", "👇 Secure your membership now".
 - Avoid soft/passive phrasing like "See what's open", "Explore options", "Check availability". Push for action.
 - Use one emoji (👇 preferred, it points to the Learn More button). Keep the line under 9 words. Never use fake scarcity ("only 3 left", specific countdowns). Keep urgency seasonal/membership-driven and truthful.`;

const HEADLINE_RULES = `HEADLINE RULES (CRITICAL):
- 4-6 words, plain English, benefit-driven.
- NO wordplay, NO riddles, NO "as easy as X" / "as simple as Y" constructions.
- NO clever metaphors that require a second read. Say what the offer is.
- Good headlines: "Boating Without The Headaches", "Your Boat Is Waiting", "Skip Ownership. Keep The Weekends.", "Members Boat Every Weekend", "All The Fun. None Of The Work.", "Unlimited Boating. Zero Hassle."
- Bad headlines (do NOT generate these): "Easy As Show Up", "Boating Made Simple As Pie", "Just Add Water", anything that reads like a tagline puzzle.`;


/**
 * Ties each variation to the photo it will run with.
 *
 * Images are the expensive artifact, 40-60 seconds and real money each, so
 * the copy adapts to them rather than the other way round. Without this the
 * pairing is arbitrary and a fishing-at-sunrise photo can end up carrying
 * watersports copy.
 */
function buildImagePairingSection(pairedImages: Array<string | null> | undefined): string {
  const described = (pairedImages ?? []).filter(Boolean);
  if (described.length === 0) return "";

  const lines = (pairedImages ?? [])
    .map((description, i) =>
      description ? `${i + 1}. ${description}` : `${i + 1}. (no image, write it standalone)`,
    )
    .join("\n");

  return `
IMAGE PAIRING (IMPORTANT):
Each variation runs with a specific photo, listed below in order. Variation 1 runs with image 1, variation 2 with image 2, and so on.

Write each variation so it belongs with its image. The copy and the photo are one ad: if the photo shows an early-morning fishing scene, that variation should not be about family watersports. Reference what is in the frame naturally. Never describe the photo literally, and never say "pictured above" or "as shown".

If an image already carries its own headline, offer, review or badge, do NOT repeat it. The copy earns its place by adding what the image does not say. Restating the offer the image already shows wastes the only lines you get.

Where a variation has no image, write it standalone.

${lines}
`;
}

export function buildBoatClubPrompt(input: CopyPromptInput): string {
  const brandContext = buildBrandContext(input.brand, input.clientName.split(/\s+[-–—]\s+/)[0] ?? "");
  const seasonalSection = buildSeasonalSection(
    input.seasonType,
    input.now ?? new Date(),
    input.timeZone,
  );
  const promoSection = buildPromoSection(input.currentPromotion);

  return `${LENGTH_RULES}

${VOICE_RULES}

An ad for a boat club, written the right way:
"One membership, and the boat is ready when you are.

Carefree members run the Space Coast, Lake County and Crystal River without owning any of it. You book a boat, we have it fueled and in the water, and you hand the keys back at the end of the day. No maintenance, no storage, no insurance to chase.

Four marinas, one membership across all of them.

👇 See membership options near you"

In the JSON output, use \\n between lines within a paragraph and \\n\\n between paragraphs.

NEVER SAY. These rules override all other instructions:
- Never reference specific membership numbers, counts, or quantities for individual clubs (e.g. 'hundreds of members', 'thousands choose us', '500 members nearby')
- Never use vague social proof numbers of any kind
- If referencing social proof, use qualitative language only, e.g. 'Members across Central Florida choose Carefree over ownership' or 'Boaters throughout the region made the switch'
- NEVER compare cost of membership vs. cost of boat ownership. Do NOT say things like "ownership costs 3x more", "cheaper than owning", "fraction of the cost", "save thousands vs buying", or any dollar/multiplier comparison to ownership. We are not going down the cost-of-ownership rabbit hole. Frame value around access, simplicity, and lifestyle, never price math.

You are an expert Meta (Facebook/Instagram) ad copywriter for ${input.clientName}, a membership boat club. Your job is to write scroll-stopping ad copy that drives clicks to a landing page lead form.
${brandContext || DEFAULT_BOAT_CLUB_VOICE}
${SHAPE_RULES}

${VARIETY_RULES}

FORMATTING:
- \\n between lines within a paragraph, \\n\\n between paragraphs
- No exclamation marks
- One emoji, on the call to action only
- The call to action gets its own line at the end

The call to action must never be motivational filler. Banned outright, in any variant: "The water is calling right now", "Don't watch another weekend pass from shore", "Stop planning. Start boating", "Summer won't wait", "Make this weekend count", "Your weekend is waiting", "Time to get on the water", "Adventure awaits", "Life's better on the water". The line before it must be concrete: the current promotion stated plainly, or a real detail about the club, its locations, its fleet or what membership actually involves.

${CTA_RULES}

${HEADLINE_RULES}

ANGLES TO ROTATE THROUGH:
1. Lifestyle/family 2. Simplicity 3. Local waterways 4. Social proof 5. FOMO 6. Weekend transformation
(Do NOT use a cost-savings / cost-vs-ownership angle.)

CLUB SPECIFIC CONTEXT:
${input.locationDescription}
${seasonalSection}${promoSection}
Generate exactly ${input.count} variations with a balanced rotation through all 6 angles.`;
}

export function buildGenericPrompt(input: CopyPromptInput): string {
  const brandContext = buildBrandContext(input.brand, input.clientName);
  const promoSection = buildPromoSection(input.currentPromotion);

  return `${LENGTH_RULES}

${VOICE_RULES}

In the JSON output, use \\n between lines within a paragraph and \\n\\n between paragraphs.

You are an expert Meta (Facebook/Instagram) direct-response copywriter writing scroll-stopping ad copy for a business that drives clicks to a landing page lead form.

BUSINESS: ${input.clientName || "this client"}
LOCATION: ${input.locationDescription || "(not specified)"}
WHAT THEY SELL:
${input.businessTypeDescription || "(not provided, infer from the business name and location)"}

OFFER / WHAT THE AD SHOULD DRIVE TO:
${input.offerDescription || "Driving a free consultation or lead form submission."}

VOICE / TONE:
${input.toneKeywords || "warm, confident, conversational, benefit-driven"}
${brandContext}
${SHAPE_RULES}

${VARIETY_RULES}

FORMATTING:
- \\n between lines within a paragraph, \\n\\n between paragraphs
- No exclamation marks
- One emoji, on the call to action only
- The call to action gets its own line at the end
- No invented numeric social proof ("hundreds of clients", "1000s of reviews")

The line before the call to action must be concrete: the offer above stated plainly, or a real detail about this business: where it is, what it actually does, its hours, its guarantee. Never motivational filler like "now is the time", "don't wait", "your moment is here" or "adventure awaits".

${CTA_RULES}

HEADLINE: 4-6 words, plain English, benefit-driven. NO wordplay, NO riddles, NO "as easy as X" / "as simple as Y" constructions. Say what the offer is. Do not be clever.

ANGLES TO ROTATE THROUGH:
1. Desire/outcome 2. Simplicity/ease 3. Local/specific 4. Social proof 5. FOMO/urgency 6. Transformation
${promoSection}
Generate exactly ${input.count} variations with a balanced rotation through all 6 angles.`;
}

export function buildSystemPrompt(input: CopyPromptInput): string {
  return input.industry === "boat_club"
    ? buildBoatClubPrompt(input)
    : buildGenericPrompt(input);
}

export function buildUserMessage(input: CopyPromptInput): string {
  const ask =
    input.industry === "boat_club"
      ? `Write Meta ad copy for this boat club location: ${input.locationDescription}. Generate exactly ${input.count} variations with a balanced mix of all 6 angles.`
      : `Write Meta ad copy for ${input.clientName || "this business"} (${input.locationDescription || "no location"}). Generate exactly ${input.count} variations with a balanced mix of all 6 angles.`;

  // The image list changes every request, so it lives here rather than in the
  // system prompt: anything volatile in the cached prefix means the cache
  // never hits.
  return ask + buildImagePairingSection(input.pairedImages);
}

# AdFlow — Handover Spec (source of truth)

Captured 2026-09-03 from the Lovable project via a read-only export prompt.
Lovable project backend: Supabase ref `mremzsrvcpxlrixsginc`, us-east-1,
**Lovable Cloud managed** (not in the owner's own Supabase org).

This is the authoritative description of the system being rebuilt. Where the
rebuild deliberately diverges, `PLAN.md` says so and why.

---

## 1. Product

Single-operator internal tool for a media buyer running Meta lead-gen campaigns
for multiple client businesses — originally Carefree Boat Club franchise
locations, extended to marinas (rentals, wet slips, dry storage, full service)
and generic verticals (med spa, fitness, real estate, home services).

It **writes to Meta; it does not read from Meta.** There is no reporting: no
spend, no CPL, no CTR, no Insights API call anywhere. It is a creation and
publishing pipeline.

Exactly one user: the owner. No roles, no per-user scoping, no multi-tenancy.

### Core journeys

1. **Onboard a client** — Clients → Add Client → "Pull from Meta" lists ad
   accounts + Pages the system-user token can see → pick account (autofills id
   + name) and Page → choose Industry (+ Marina Business Type when
   `industry = 'marina'`) → optional "Auto-fill with AI" → landing page URL,
   pixel id, current promotion → save.
2. **Build a creative library** — upload images (WebP auto-converted to JPEG
   client-side; Facebook rejects WebP) or "Generate AI": pick a Scene (bank
   depends on industry + marina subtype) and a count (3/6/9/12) → streaming
   NDJSON shows images as they finish → select which to keep.
3. **Sync creatives to Facebook** — bulk-upload images lacking `fb_image_hash`
   to `/{ad_account}/adimages`, store the returned hash.
4. **Generate copy** — slider 10–50 variations → `generate-ads` (Claude) →
   variations inserted `status='generated'`, round-robin paired with the
   client's non-archived creatives → approve / reject / reset each card →
   Excel export, creatives ZIP export.
5. **Push to Facebook** — Load Campaigns → campaign → ad set → optional
   Instagram account → optional Cloudinary overlay → each approved variation
   becomes an ad creative + an ad with `status=PAUSED`, UTM tags, pixel
   tracking spec. Writes back `fb_draft_id` and `status='pushed'`.
6. **Settings** — FB credentials, Anthropic key, Master Image Prompt, Brand
   Settings (with website scrape).

---

## 2. Routes

`react-router-dom` v6. Three routes only.

| Path | Component | Gate |
|---|---|---|
| `/auth` | `pages/Auth.tsx` | public |
| `/` | `pages/Index.tsx` via `ProtectedRoute` | auth-gated |
| `*` | `pages/NotFound.tsx` | public |

The five screens (clubs / creatives / generate / push / settings) are
`useState` inside `Index.tsx`, **not routes**. Deep-linking is impossible;
refresh always lands on Clients and loses the selected client.

---

## 3. Frontend

Vite + React 18 + TypeScript + Tailwind v3 + shadcn/ui. Dark mode only (single
token set under `:root`, no light theme, nothing toggles a class).

State: `@tanstack/react-query` v5 for all server state; one zustand store
(`selectedClubId`, plus a dead `accessToken`), not persisted.

Query keys: `["clubs"]`, `["club", id]`, `["creatives", id]`,
`["ad_variations", id]`, `["approved_ads", id]`, `["fb_campaigns", acct]`,
`["fb_adsets", campaign]`, `["ig_accounts", acct]`. FB queries use
`staleTime: 5m`; `fb_campaigns` is `enabled: false` + manual `refetch()`;
`fb_adsets` sets `retry: false`.

**No form library and no schema validation in use** despite `react-hook-form`,
`@hookform/resolvers` and `zod` all being installed. Plain controlled inputs,
HTML-attribute validation only. Bad data (ad account id missing `act_`,
malformed pixel id, non-URL landing page) is accepted and fails later at the
Facebook call.

`tsconfig` is deliberately loose: `noImplicitAny: false`,
`strictNullChecks: false`. Porting to strict TS will surface many errors,
especially around `any`-typed club/variation objects.

### Dead weight to drop in the rebuild

`recharts`, `html2canvas`, `react-hook-form`, `@hookform/resolvers`, `zod`,
`date-fns`, `cmdk`, `embla-carousel-react`, `input-otp`,
`react-resizable-panels`, `vaul`, `next-themes`, `lovable-tagger`;
25 of 47 shadcn primitives; `NavLink.tsx`; `clubStore.accessToken`;
`exportAdsPdf`'s PDF path (implemented, no button); `App.css`.

---

## 4. Database

Six tables, all RLS-enabled. Row counts at handover: `clubs` 14,
`creatives` 169, `ad_variations` 100, `pain_points` 0, `brand_settings` 1,
`app_settings` 13. Storage objects in `creatives` bucket: 236.

```sql
CREATE TABLE public.clubs (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL,
  fb_page_id                text,
  fb_ad_account_id          text,
  landing_page_url          text,
  location_description      text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  instagram_account_id      text,
  fb_pixel_id               text,
  current_promotion         text,
  market_name               text,
  boating_style             text,
  environment_style         text,
  season_type               text NOT NULL DEFAULT 'seasonal'
                                 CHECK (season_type IN ('seasonal','year_round')),
  industry                  text NOT NULL DEFAULT 'boat_club',
  business_type_description text,
  offer_description         text,
  tone_keywords             text,
  marine_business_type      text
);

CREATE TABLE public.creatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  image_url     text NOT NULL,
  fb_image_hash text,
  label         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  archived      boolean NOT NULL DEFAULT false
);

CREATE TABLE public.ad_variations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  headline     text NOT NULL,
  primary_text text NOT NULL,
  creative_id  uuid REFERENCES public.creatives(id) ON DELETE SET NULL,
  fb_draft_id  text,
  status       text NOT NULL DEFAULT 'generated',  -- no CHECK; observed:
                                                   -- generated|approved|rejected|pushed
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pain_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  text text NOT NULL, source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.app_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name        text NOT NULL UNIQUE,
  encrypted_value text,   -- MISNOMER: plaintext
  is_set          boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_settings (   -- ONE GLOBAL ROW for every client
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_website_url text, brand_voice text, key_phrases text,
  never_say text, ad_examples text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**Indexes: primary keys plus `app_settings_key_name_key` only.** No index on
any `club_id` even though every list query filters by it.

**No functions, no triggers, no views, no enums, no pg_cron, no webhooks.**
`updated_at` is set by application code, never automatically.

### RLS

All policies are `USING (true)` for role `authenticated` — binary auth, no
ownership model. `pain_points` has no UPDATE/DELETE policy. `app_settings` has
**zero policies** and all grants revoked from `anon` and `authenticated`;
reachable only by edge functions via service-role.

### Storage

One bucket `creatives`, `public = true`, no size limit, no MIME allow-list.
**Must stay public-read** — Facebook's `adimages` endpoint and Cloudinary both
fetch the raw URL server-side.

Paths: uploads `{club_id}/{ts}_{rand}.{ext}`; saved AI images
`{club_id}/ai_{ts}_{idx}.png`; direct function writes
`{club_id}/generated/{ts}-{idx}-{uuid}.png`.

Deleting a `creatives` row does **not** delete the object — 236 objects back
169 rows.

### Auth

Email + password only. No OAuth, no magic link, no forgot-password. Signups
disabled server-side but the sign-up toggle is still exposed in the UI.
`persistSession: true`, `autoRefreshToken: true`, storage adapter is
Lovable-preview-specific (`previewAuthStorage.ts`) and must be replaced.

---

## 5. Edge functions

Twelve functions. **`verify_jwt = false` on ten of them**: `generate-images`,
`generate-ads`, `manage-settings`, `push-to-facebook`, `fetch-fb-campaigns`,
`fetch-fb-adsets`, `fetch-ig-accounts`, `scrape-brand-voice`,
`autofill-club-fields`, `fetch-fb-ad-accounts`. Only `process-creative` and
`upload-to-facebook` require a JWT. Every function that touches the DB uses the
service-role key and bypasses RLS entirely.

| Function | Job | Notes |
|---|---|---|
| `generate-ads` | N copy variations via Claude, round-robin paired with creatives | `claude-sonnet-4-20250514`, `max_tokens: 8192`, 4 retries on 529/503 |
| `generate-images` | N images via Lovable AI Gateway, streaming NDJSON | `openai/gpt-image-2`, 1024x1024, quality high; 10s heartbeat |
| `manage-settings` | KV CRUD over `app_settings` + FB/FAL connection tests | **`get_value` returns plaintext secrets with no auth** |
| `push-to-facebook` | approved variations → ad creatives → PAUSED ads | Graph v21.0, fully sequential |
| `upload-to-facebook` | images → `/adimages`, store hash | Graph v21.0, batches of 4, JWT required |
| `process-creative` | Cloudinary text-overlay composite | SHA-1 signature; `preview_only` accepted but unused |
| `autofill-club-fields` | prefill client form from name/location | `google/gemini-2.5-flash`; never touches the DB |
| `fetch-fb-ad-accounts` | list ad accounts + Pages | v21.0, paginated, cap 1000 |
| `fetch-fb-campaigns` | campaigns for an ad account | v19.0, **no pagination** |
| `fetch-fb-adsets` | ad sets for a campaign | v19.0, **no pagination**; rate limit returned as HTTP 200 |
| `fetch-ig-accounts` | merge IG identities from 3 endpoints | v21.0; `page_id` never sent, so 2 of 3 are dead |
| `scrape-brand-voice` | infer brand voice from a website | Claude; hardcoded Carefree paths |

---

## 6. The prompt library (the actual IP)

This is the hardest-won and least reproducible part of the system. Preserve it
verbatim on migration, then move it into versioned DB rows.

### `generate-ads` — boat club system prompt

```
⚠️ STRICT LENGTH LIMIT — THIS OVERRIDES ALL OTHER INSTRUCTIONS:

Maximum 7 lines total. Count them. If it's 8 or more lines it is WRONG.
Maximum 10 words per line. Count them. If a line exceeds 10 words split it or cut it.
The entire primary text must fit in an Instagram caption preview without clicking "more".
When in doubt, cut. Shorter is always better on Meta.
After writing each ad, count the lines before returning it. If it exceeds 7 lines, edit it down before returning.

The ideal ad looks exactly like this — 6 lines with paragraph breaks between sections:
"One membership. Unlimited adventures.
Carefree Boat Club lets you explore the Space Coast, Lake County, and Crystal River.

Cruise open water. Fish pristine springs. Enjoy family watersports.
No maintenance. No storage. No insurance.

You reserve a boat. Show up. Enjoy the water.
👇 See membership options near you."

Note: In the JSON output, use \n between lines within a section and \n\n between sections.

DO NOT exceed this length under any circumstances.

NEVER SAY — these rules override all other instructions:
- Never reference specific membership numbers, counts, or quantities for individual clubs (e.g. 'hundreds of members', 'thousands choose us', '500 members nearby')
- Never use vague social proof numbers of any kind
- If referencing social proof, use qualitative language only — e.g. 'Members across Central Florida choose Carefree over ownership' or 'Boaters throughout the region made the switch'
- NEVER compare cost of membership vs. cost of boat ownership. Do NOT say things like "ownership costs 3x more", "cheaper than owning", "fraction of the cost", "save thousands vs buying", or any dollar/multiplier comparison to ownership. We are not going down the cost-of-ownership rabbit hole. Frame value around access, simplicity, and lifestyle — never price math.

You are an expert Meta (Facebook/Instagram) ad copywriter for Carefree Boat Club, the nation's premier membership boat club. Your job is to write scroll-stopping ad copy that drives clicks to a landing page lead form.

[brandContext, or this fallback:]
BRAND VOICE:
- Aspirational but accessible — boating should feel achievable, not exclusive
- Effortless and hassle-free — the core promise is all the joy with none of the ownership headaches
- Warm, active, lifestyle-forward — families, friends, weekends, memories
- Never corporate or stiff — conversational but polished
- Key brand phrases to draw from: 'We make boating easy. You make it unforgettable', 'All the best parts of boating', 'No maintenance. No slip fees. No stress. Just fun.'

PRIMARY TEXT STRUCTURE — follow this format exactly for every ad:

Section 1 (lines separated by \n):
Line 1: Hook/opening statement — short, punchy, sets the tone.
Line 2: Location-specific line — connect to the specific club location and waterways.

[blank line — use \n\n here]

Section 2 (lines separated by \n):
Line 3: Activity or benefit line — 3-4 activities separated by periods.
Line 4: Pain point elimination line — ownership headaches removed.

[blank line — use \n\n here]

Section 3:
Line 5: MUST be concrete. Either (a) the current promotion stated plainly, or (b) a specific, tangible proof/specificity line — a real detail about the club, locations, fleet, or member experience. NEVER a motivational urgency platitude.
   - BANNED line 5 patterns (do NOT generate any of these or variants): "The water is calling right now", "Don't watch another weekend pass from shore", "Stop planning. Start boating", "Summer won't wait", "Make this weekend count", "Your weekend is waiting", "Time to get on the water", "Adventure awaits", "Life's better on the water", or any similar vague urgency/motivational filler.
   - GOOD line 5 examples: "Four marinas. One membership. Boats ready Friday.", "Pontoons, deck boats, and bowriders across the fleet.", "Members across Central Florida chose Carefree over ownership.", "Reserve from your phone — boat is fueled and waiting.", or the actual current promotion when one applies.
Line 6: CTA line with a single relevant emoji. Conversational, tells them what they'll get — never tells them what to click.

FORMATTING RULES:
- Use \n between lines within a section
- Use \n\n between sections to create paragraph breaks in Facebook rendering
- Periods used to separate ideas within a line, not commas
- No exclamation marks
- No emojis except a single relevant one on the CTA line
- Total length: 6 lines maximum (with 2 blank-line breaks between sections)
- Every ad must follow this structure

CTA RULES (CRITICAL — these override everything else for the CTA line):
- NEVER use the words "click", "tap", "instant access", "learn more" (as a verb), or "act now" in the CTA line.
- NEVER say "Click Learn More" or "Hit Learn More" — Meta penalizes this and it sounds robotic.
- The CTA should describe what the user will GET or DO next, with a clear action-driven verb that creates real urgency.
- Lead with strong action verbs: "Join", "Claim", "Reserve", "Grab", "Lock in", "Secure", "Start", "Get". Membership/season-driven urgency is encouraged ("before summer", "this season", "this week", "spots filling").
- Good CTAs: "👇 Join now before summer fills up", "Claim your spot this season 👇", "👇 Reserve your home marina today", "Lock in membership this week 👇", "👇 Start boating this weekend", "Grab a spot before the season starts 👇", "👇 Secure your membership now".
- Avoid soft/passive phrasing like "See what's open", "Explore options", "Check availability" — push for action.
- Use one emoji (👇 preferred — points to the Learn More button). Keep the line under 9 words. Never use fake scarcity ("only 3 left", specific countdowns) — keep urgency seasonal/membership-driven and truthful.

HEADLINE RULES (CRITICAL):
- 4-6 words, plain English, benefit-driven.
- NO wordplay, NO riddles, NO "as easy as X" / "as simple as Y" constructions.
- NO clever metaphors that require a second read. Say what the offer is.
- Good headlines: "Boating Without The Headaches", "Your Boat Is Waiting", "Skip Ownership. Keep The Weekends.", "Members Boat Every Weekend", "All The Fun. None Of The Work.", "Unlimited Boating. Zero Hassle."
- Bad headlines (do NOT generate these): "Easy As Show Up", "Boating Made Simple As Pie", "Just Add Water", anything that reads like a tagline puzzle.

ANGLES TO ROTATE THROUGH:
1. Lifestyle/family 2. Simplicity 3. Local waterways 4. Social proof 5. FOMO 6. Weekend transformation
(Do NOT use a cost-savings / cost-vs-ownership angle.)

CLUB SPECIFIC CONTEXT:
${location_description}
${seasonalSection}${promoSection}
OUTPUT FORMAT:
Return a JSON array only. No preamble, no markdown, no explanation. Each object must have:
- headline (4-6 words)
- primary_text (with \n line breaks, following the structure above)
- angle (lifestyle | simplicity | local | social_proof | fomo | weekend)

Generate exactly ${count} variations with a balanced rotation through all 6 angles.
```

### Seasonal blocks (boat club)

`NEVER_NAME_MONTH` is appended to every branch:

> NEVER name a specific month (no "${monthName}", "July", "August", "this
> month", etc.) — copy may run into the next month and go stale. Use "this
> weekend", "right now", "this summer", or "the season" instead.

- **`season_type = 'year_round'`** (overrides month entirely) — bans all
  seasonal urgency: no "this summer", "by July it's gone", "before summer
  slips away", "the season is here", "pre-season", "spring ramp", "get ready
  for next season". Urgency must come from lifestyle FOMO, weekend
  transformation, simplicity, or the promotion. FOMO/weekend angles reference
  *this weekend* / *right now*, never a calendar season.
- **month 4–7** — peak season. ≥60% of variations use fomo or weekend. Cost of
  waiting framed as missed memories, never dollars.
- **month 8–9** — late season: "still warm, still on the water" + lock in
  before next summer fills.
- **month ≥10 or ≤1** — pre-season: lock in before summer demand, be ready
  when the weather turns.
- **else (2–3)** — spring ramp-up: season starting, first warm weekends.

Month is `new Date().getMonth()` in the **edge function's UTC clock**.

### Promotion block

Injected when `current_promotion` is set. Instructs "approximately 30% of the
generated ad variations", woven in as a hook or closing line, never pasted
mechanically. **Soft instruction to the model, not enforced in code.**

### `generate-ads` — generic (non-boat-club) system prompt

Same 7-line/10-word cap and the same section structure, but parameterized on
`${clubName}`, `${location_description}`, `${businessTypeDescription}`,
`${offerDescription}`, `${toneKeywords}`. Line 5 has the same
"must be concrete, never a motivational platitude" rule. Same CTA verb list and
bans. Same 4–6 plain-word headline rule. Angles: desire/outcome, simplicity,
local/specific, social proof, FOMO/urgency, transformation.

Known wart: the brand-voice block is labeled `CAREFREE BRAND VOICE:` even for
non-boat-club clients, because `brand_settings` is one global row.

### `generate-images`

Three template families:

- `industry = 'boat_club'` → `app_settings.master_image_prompt` (falling back
  to an in-file `DEFAULT_MASTER_PROMPT`), scene bank `BOAT_CLUB_SCENES`, vars
  `{market_name}` (falls back to `location_description` → `name` → "the local
  area"), `{boating_style}`, `{environment_style}`, `{scene}`, `{headline}`,
  `{subheadline}`.
- `industry = 'marina'` + `marine_business_type` in `MARINE_SUBTYPE_TEMPLATES`
  → per-subtype template + per-subtype scene bank (`boat_rentals`,
  `wet_slips`, `dry_storage`, `storage_slips`, `full_service`), vars
  `{business_name}`, `{market_clause}`, `{environment_style}`, `{scene}`,
  `{headline}`.
- everything else → `GENERIC_PROMPT_TEMPLATE`, vars `{business_name}`,
  `{market_clause}`, `{business_type_description}`, `{tone_keywords}`,
  `{headline}`; no scene.

`fillTemplate()` always appends `REALISM_CONSTRAINTS` — physical plausibility
of loose gear, boat state matching the scene verb, no-dock exclusivity,
correct passenger poses, no AI artifacts, no text/logos/watermarks.

`resolveScene(bank, sceneId, idx)` returns the named scene unless `sceneId` is
unset or `"mixed"`, in which case it picks
`ids[(idx - 1 + floor(random * len)) % len]` — **"mixed" can repeat scenes.**

---

## 7. Data flow

Entirely manual and user-initiated. No sync, no import, no cron, no webhook.
Data flows out to Facebook only on an explicit Push click.

**AdFlow computes no advertising metrics at all** — no CPL, CPC, CTR, CPM,
ROAS, conversion rate, pacing, or deltas. No Insights call, no spend or
impressions field. Consequently there is no divide-by-zero handling, no
gap filling, no currency handling, no timezone normalization — because there
are no metrics.

The only real business formula: **creative↔copy pairing** in `generate-ads` is
`creative_id = creatives[i % creatives.length].id` over the client's
**non-archived** creatives with **no `ORDER BY`** (arbitrary Postgres order).
Zero non-archived creatives → `creative_id` is null and those variations
cannot be pushed.

Retries: Claude 529/503 → 4 attempts, linear 1s/2s/3s (`generate-ads` only;
`scrape-brand-voice` has none). FB creative with IG actor → one retry without.
FB 613 → surfaced with `Retry-After: 60`, user retries by hand. Image failures
are reported per-image and dropped; no regeneration.

Three unreconciled clocks: ad names use UTC (`toISOString().slice(0,10)`),
exports use browser local time, month-suppression uses the edge function's UTC.

---

## 8. Known defects

### Security

- **`manage-settings` is unauthenticated and leaks every secret.** `verify_jwt`
  is false and `get_value` returns any `app_settings` row in plaintext —
  including `fb_access_token`, `fb_app_secret`, `anthropic_api_key`,
  `cloudinary_api_secret`. `save` lets anyone overwrite credentials. Anyone who
  knows the project URL can extract every credential. **Single most serious
  defect in the project.**
- Nine other functions are likewise unauthenticated.
- Secrets live as plaintext rows in a queryable table. The column name
  `encrypted_value` is a lie.

### Correctness

- `MasterImagePromptSection` reads/writes `app_settings` directly from the
  browser, but grants were revoked — **loading silently falls back to the
  in-file default and saving fails.**
- **Three contradictory master image prompts exist.** The DB row (seeded by
  migration `20260602193413`) says bake in typography, logo, benefits list and
  a yellow JOIN TODAY button. `DEFAULT_MASTER_PROMPT` in
  `MasterImagePromptSection.tsx` says the opposite — clean photo, no text. A
  third lives in `generate-images/index.ts`. The DB row wins, so the
  bake-in-text version runs, contradicting `REALISM_CONSTRAINTS` (which forbids
  on-image text) and the entire overlay architecture.
- **Cloudinary hashes are never persisted** — with the template on,
  `push-to-facebook` re-uploads a fresh image every push and discards the hash,
  accumulating duplicate ad images.
- **The `"none"` IG option is a magic string** — `"none"` is truthy, so it is
  spread into the body as `ig_account_id: "none"`, which Facebook rejects. The
  intent was to omit it.
- Deleting a creative orphans its storage object (236 objects / 169 rows).
- `fetch-fb-campaigns` and `fetch-fb-adsets` don't paginate.
- `fetch-ig-accounts` never receives `page_id`, so 2 of 3 discovery endpoints
  are dead in practice.
- `campaign_id` is required by `push-to-facebook` but never used in any Graph
  call.
- `"mixed"` scene selection can repeat scenes.
- Sign-up UI is exposed although signups are disabled server-side.
- `PushTab` invalidates a nonexistent `["dashboard_ads", id]` key.
- Excel styling (`cell.s`, `!cols`, `!freeze`) is a no-op in the community
  `xlsx` build; the "Image File" column hardcodes `.jpg` even for PNGs.
- `exportAdCopyPdf` is implemented but unreachable.
- `AdCreativeOverlay` is orphaned — imported by `FacebookAdPreview`, which then
  renders a plain `<img>` instead.

### Performance

- **AI image generation dominates**: ~40–60s per image, ~150s for a batch of
  12 even parallelized. Inherent to `gpt-image-2` at quality high.
- **`push-to-facebook` is fully sequential** — 20 ads takes minutes and risks
  the wall-clock limit. Highest-value thing to parallelize.
- Base64 encoding in `uploadImageUrlToFacebook` builds a JS string in 8KB
  chunks via `String.fromCharCode(...chunk)` — O(n) concatenation over
  multi-MB images. `upload-to-facebook` already posts the blob directly as
  `source`; `push-to-facebook` should match.
- `bulkUpdate` fires one mutation per row — approving 50 issues 50 PATCHes.
- `saveSelectedImages` re-downloads each image from storage and re-uploads it,
  though `generate-images` already wrote it to the bucket.
- No `club_id` indexes.

### Hardcoded / Carefree-specific

Cloudinary tagline `"One Membership. Unlimited Adventures."`, promo pill
`rgb:0066CC`, folder `adflow`, fonts `Arial_32_bold` / `Arial_28_bold`;
`AdCreativeOverlay` navy `#0c1f3d`, yellow `#f5b800`, `JOIN TODAY`,
"No Maintenance. Just Memorable Days.", three fixed benefit labels;
`FacebookAdPreview` display domain `learn.carefreeboats.com` regardless of the
client; `scrape-brand-voice` paths `/why-join`, `/how-it-works`,
`/the-carefree-difference`; `push-to-facebook` fallback link
`"https://example.com"`, `call_to_action.type: "LEARN_MORE"`,
`status: "PAUSED"`; Graph version per-file (v19.0 vs v21.0); model ids inline;
`num_images` capped at 12; brand voice truncated to 2000 chars, scraped pages
to 15,000; `upload-to-facebook` batch size 4.

---

## 9. Non-obvious rules — a rewrite will silently get these wrong

1. **Client names encode a hierarchy.** `"Carefree Boat Club - South Florida"`
   → brand + location. Separator must be a hyphen, en-dash, or em-dash
   **surrounded by whitespace**. `"Brand-Location"` will not group. No schema
   support; brand prefixes are deliberately not stripped.
2. **`industry = 'marina'` alone is not enough** — without
   `marine_business_type` a marina falls through to the bland generic prompt.
   Valid: `boat_rentals`, `wet_slips`, `dry_storage`, `storage_slips`,
   `full_service`.
3. **Only `boat_club` reads `master_image_prompt`** — every other industry
   ignores it, making the "Master Image Prompt" settings editor misleading.
4. **Never name a month in ad copy** — ads outlive the month they were written.
5. **`year_round` bans all seasonal urgency framing** (Florida, Texas,
   Arizona, SoCal). Urgency comes from weekend FOMO, simplicity, or a real
   promotion.
6. **Never compare membership cost to ownership cost.** No "cheaper than
   owning", no fractions, no multipliers, no dollar math. Explicit product
   decision.
7. **Never use numeric social proof.** Qualitative only.
8. **Never invent an offer.** `autofill-club-fields` is explicitly forbidden
   from generating dollar amounts, percentages, time windows, or promotions —
   it once fabricated a "20% off first-time renter discount" that did not
   exist, which is a real liability in paid ads.
9. **Business-name keywords are ground truth.** "Rental", "Storage", "Slips",
   "Service", "Repair", "Charter", "Sales" in the name IS the primary
   offering. Commit, don't hedge.
10. **Ads are always pushed PAUSED.** Nothing in this tool ever activates an
    ad. Never change this default.
11. **One shared system-user token, not per client.** Onboarding = granting
    that system user asset access in Business Manager. No OAuth, no per-client
    reconnect. Rotating = updating one row.
12. **The `creatives` bucket must stay public-read** — Facebook and Cloudinary
    fetch the raw URL from outside any session.
13. **Facebook rejects WebP.** Converted to JPEG at quality 0.95 in-browser via
    canvas before upload. Do not remove.
14. **A rate-limited response is HTTP 200** with `{retryable: true, code: 613}`
    because `functions.invoke` cannot read non-2xx bodies. Consumers must check
    the body, not the status.
15. **Copy and images are decoupled on purpose** — images are generated clean
    and paired round-robin after the fact, so a photo can be reused with any
    headline. Pairing uses non-archived creatives only.
16. **Archive ≠ delete.** Archived creatives stay attached to existing
    variations and stay in storage; excluded from the grid, from sync, and from
    new pairings.
17. `generate-ads` requires `location_description`; `GenerateTab` passes
    `club.location_description || club.name`, so a client with no location
    silently gets its own name as location context.
18. The promotion appears in ~30% of variations **by model instruction only**.
19. **Line 5 must be concrete** — an explicit blocklist of motivational
    platitudes exists and must survive.
20. **CTAs lead with an action verb**, under 9 words, one emoji (👇 preferred,
    it points at the Learn More button), never "click"/"tap"/"instant
    access"/"Learn More" as a verb, never fake scarcity.
21. **Headlines are 4–6 plain words.** No wordplay.
22. Cloudinary overlay defaults **on**, and enabling it forces a fresh FB image
    upload per push.
23. Ad name embeds the **UTC** date: `{club} - {headline} - YYYY-MM-DD`.
24. Excel "all" export includes pushed ads, excludes only rejected.
25. **`brand_settings` is one global row applied to every client** — wrong for
    a multi-vertical roster, highest-value schema fix.
26. Generic and marina image prompts require **clean negative space top and
    bottom** for later headline overlays; extreme-wide framing was explicit and
    repeatedly reinforced.
27. **Regenerating is expected after any prompt change.** Existing variations
    are never retroactively updated.

---

## 10. Open questions carried into the rebuild

- Live Supabase Auth config (JWT expiry, refresh window, redirect allow-list,
  SMTP, templates) — unverified.
- Whether the exposed secrets were ever rotated — **assume not**.
- Facebook Business Manager config: which system user, which asset
  assignments, which app, app review status, token permissions, Live vs
  Development mode — all unknown from the codebase.
- Cloudinary plan and transformation quota.
- Which of the 236 storage objects are orphans.
- Build/test status — the suite, linter and typecheck were never run during
  handover. Effective test coverage is ~zero (one example unit test, no
  Playwright specs despite config and fixture).
- `.lovable/plan.md` contents, which may hold product intent not in code.

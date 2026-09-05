# AdFlow rebuild — plan

Goal, in the owner's words: *"an easy and simple way to launch multiple ads
with ease, all pushed to Meta Ads Manager, without me having to do anything
crazy."*

That is a **workflow** goal, not a feature goal. The Lovable build already does
everything technically necessary. What it doesn't do is get out of the way.
This plan is organized around that.

---

## 0. Do this before anything else (not part of the rebuild)

`manage-settings` has `verify_jwt = false` and a `get_value` action that
returns any `app_settings` row in plaintext. No auth check exists anywhere in
the function. That means anyone who knows the Supabase project URL can read:

- `fb_access_token` — a Business Manager **system-user token with asset access
  to 14 clients' ad accounts**
- `fb_app_secret`, `fb_app_id`
- `anthropic_api_key`
- `cloudinary_api_key` / `cloudinary_api_secret`

and `save` lets them overwrite any of it. The worst case is not data loss —
it's someone spending clients' ad budgets, or running ads from client Pages.

**This is live right now and the rebuild takes weeks. Do not wait for it.**

1. Rotate every credential above. Assume all are burned.
2. In the Lovable project, either delete the `get_value` action outright or set
   `verify_jwt = true` for `manage-settings` in `supabase/config.toml`.
   (`get_value` is only called server-side; the browser never needs it.)
3. Check Meta Business Manager for ads or ad accounts you don't recognize.

Everything else in this document can proceed at a normal pace.

---

## 1. Target architecture

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) on Vercel** | Server-side by default, which is what actually fixes the secret problem; you already run Vercel |
| Data / Auth / Storage | **Supabase, kept** | Data, RLS, auth and 236 storage objects already work. Moving to Vercel Postgres + Blob is migration cost for no gain |
| Supabase project | **Migrate to your own org** | Today's project (`mremzsrvcpxlrixsginc`) is **Lovable Cloud managed** and is not in your Supabase org. Leaving Lovable should not put the data at risk |
| Secrets | **Vercel environment variables** | Server-only, never queryable, never in a table. Structurally eliminates the §0 class of bug |
| Background work | **Route handlers + a `jobs` table** | See §3 — Vercel's execution limits are the one real constraint here |

### Why Next.js rather than porting the Vite SPA

The single most important consequence: **there is no client-side secret path at
all.** Every Meta and AI call becomes a server action or route handler reading
`process.env`. The entire `app_settings`-as-credential-store design — and the
`manage-settings` function with it — stops existing rather than getting patched.

Secondary wins: URL routing for free (fixes "refresh loses your client"),
streaming responses for image generation, and one deploy target you already
know.

### The Vercel constraint to design around, honestly

Two operations are long:

- **Image generation** — ~40–60s per image, ~150s for a batch of 12 even
  parallelized. Inherent to the image model, not fixable by us.
- **Push** — currently fully sequential; 20 ads takes minutes.

Vercel function duration caps depend on plan (Pro allows substantially longer
than Hobby; **verify the current limit on your plan before committing**). The
plan does not depend on winning that argument:

- Image generation **streams** (as it does today via NDJSON) — the client sees
  images land one by one, and a disconnect loses nothing already written.
- Push becomes a **job**, not a request. A `push_jobs` + `push_job_items` table
  records intent; a worker route processes items with bounded concurrency and
  writes progress. A timeout is then a resumable interruption, not a failure,
  and it fixes the "did that half-push?" question that today has no answer.

This is the piece I'd least want to shortcut, because it's also what makes
"launch 20 ads" feel like one action instead of a thing you supervise.

---

## 2. The main event: collapse five screens into one launch

Today, shipping one batch of ads is roughly:

> pick client → Creatives tab → generate or upload images → wait → select →
> save → "Sync to FB" → Generate tab → set slider → "Scrape & Generate" →
> wait → approve each card → Push tab → "Load Campaigns" → pick campaign →
> pick ad set → pick IG account → toggle template → Push

That is ~15 interactions and four screens, and most of them are the app asking
you to do its bookkeeping. Three of those steps — **Sync to FB**, **Load
Campaigns**, and re-picking the same ad set every time — are implementation
details that leaked into the UI.

### Proposed flow

**One screen. Two decisions. One review gate.**

1. **Pick a client.** Remembered per client from here on: last campaign, last
   ad set, last IG account, template on/off, typical batch size. Onboarding a
   destination happens once, not every launch.
2. **Say what you want.** "12 ads, summer promo, cruising + sunset scenes."
   Images come from the library, or generate fresh, or a mix — the app decides
   unless you override it.
3. **Hit Launch.** One job runs: generate copy → generate/select images → pair
   → upload images to Meta → build creatives → create ads **PAUSED**. Live
   progress, per-ad status, resumable.
4. **Review gate.** The grid of finished drafts, with a Facebook-accurate
   preview. Approve keeps them; reject deletes the draft from Meta. This is the
   only place your judgment is actually required.

**Decided: the gate sits after creation.** Launch builds everything as PAUSED
drafts, and you review the real rendered ads rather than a mockup. Rejecting
deletes the draft from the ad account — see §6 for what that requires. Ads are
never activated by this tool; that stays manual in Ads Manager.

### Three ways content gets in — AI is one of them, not the only one

The app must not assume it generated the ads. Two of these already need to be
first-class inputs to the launch flow above, not side doors.

**1. Images you already have.** This already exists and works — `CreativesTab`
has a dropzone (click or drag), accepts JPEG/PNG/WebP, converts WebP to JPEG
in-browser because Meta rejects it, and applies a label to the batch. It
**must survive the port intact**, including the WebP conversion. What changes
is placement: uploaded images should be selectable directly in the launch flow
alongside "generate new", not a separate tab you visit first. Client-supplied
creative and AI creative are the same thing downstream.

**2. Copy from a spreadsheet.** New. Upload `.xlsx` or `.csv` (or paste a
published Google Sheets CSV link — full Sheets API access needs OAuth and is
not worth it for this) and import headlines and primary text directly, skipping
generation entirely.

- **Column mapping step.** Read the header row, let the user map columns →
  `headline`, `primary_text`, and optionally `image` (matched against creative
  label or filename), `link`, `cta`. Remember the mapping per client so the
  same sheet format imports in one click next time.
- **Validate, warn, don't block.** Run the same rules the generator follows —
  headline 4–6 words, primary text ≤7 lines / ≤10 words per line, no
  "click"/"tap"/"Learn More" as a verb in the CTA line, no month names — and
  surface them as warnings on the row. Human-written copy is a deliberate
  choice; the app flags, the operator decides. This is the opposite of how the
  AI path treats those rules, and that asymmetry is correct.
- **Pairing.** If the sheet names an image, honor it exactly. Otherwise fall
  back to the same round-robin over non-archived creatives the generator uses.
- **Round-trip.** The existing Excel export already emits headline / primary
  text / image filename. Make the import accept **its own export format**
  unchanged, so the workflow "export → edit in Sheets with the client →
  re-import → launch" works with no reformatting. That is likely the most
  common real use.

`xlsx` is already a dependency for the export path, so parsing is nearly free.
Parse **server-side** — the community `xlsx` build has had security advisories,
and client-side parsing of a file a client emailed you is the wrong place for
it.

**3. AI generation.** As today.

The consequence worth being explicit about: **AI generation becomes optional.**
A launch is "pick a client, bring copy and images from wherever, review, push"
— and generation is one convenient source of those inputs. That is a better fit
for "a simple way to launch multiple ads" than an AI tool that also happens to
push.

### 2.2 Preview, twice, for two different reasons

**Before launch — use Meta's own renderer, not a mockup.** The Graph API can
render a real Facebook/Instagram preview from a creative spec **without
creating an ad**: `GET /act_{ad_account_id}/generatepreviews` with a `creative`
spec and an `ad_format`, which returns an embeddable iframe. There is a
matching `GET /{ad_id}/previews` for ads that already exist. (Confirm the
current `ad_format` enum values against the live Graph docs at build time —
the format list changes as placements do.)

This is strictly better than the hand-built `FacebookAdPreview` component:

- It is **Meta's actual rendering**, so what you approve is what ships —
  including truncation, line-break handling, and how the primary text collapses
  behind "... more". That last one matters a lot here, because the entire copy
  prompt is built around a 7-line / 10-word-per-line limit whose whole purpose
  is surviving that truncation. Today you are eyeballing that rule against a
  mockup that approximates it.
- It renders **every placement** — feed, Stories, Reels, Instagram — instead of
  one hardcoded desktop feed layout.
- It fixes the hardcoded `learn.carefreeboats.com` display domain for free,
  because the real renderer uses the client's actual link.

Keep the existing HTML mockup as a **fallback** for when the preview call fails
or rate-limits, and for the fast scroll through a 20-card grid where round-
tripping to Meta for every card would be slow. Rough split: mockup for the
grid, real Meta preview when you open a card.

**After launch — the drafts themselves.** Paused ads in the account, previewed
via `/{ad_id}/previews`, with keep/reject per ad. This is the final gate, and
rejecting deletes the draft from Meta (§6).

### Launch presets

Save a launch config per client: batch size, scene mix, offer, destination.
"Run the summer promo again for Crystal River" becomes one click. This is the
single highest-leverage addition for the stated goal, and it's cheap to build
once the flow above exists.

---

## 3. Fixes worth making during the port

### Security (P0 — non-negotiable)

- All secrets → Vercel env vars. `app_settings` keeps only non-secret config.
- Delete `get_value` and `manage-settings` entirely.
- Every route handler authenticated. No `verify_jwt = false` equivalents.
- Drop the dead `fal_api_key` / `test_fal` / `perplexity_api_key` surface.

### Data model (P1)

- **Per-client brand settings.** Today `brand_settings` is *one global row
  applied to every client* — a med spa gets Carefree's brand voice, and the
  prompt block is literally labeled `CAREFREE BRAND VOICE:`. This is the
  highest-value schema fix and it's currently producing wrong output.
- `clubs` → `clients`, `club_id` → `client_id`.
- **Indexes on every `client_id`.** There are currently none, on any table.
- **Prompt templates as versioned DB rows**, and store the rendered prompt on
  each generated creative. Today the prompt only exists in function logs, so
  you cannot tell which prompt produced which image.
- Enums + one taxonomy source. `industry` / `marine_business_type` are
  currently duplicated across `ClubsTab.INDUSTRIES`, `lib/scenes.ts`, and
  `generate-images`' `SCENE_BANK` — adding a subtype means editing three files
  and they can silently drift.
- Resolve the **three contradictory master image prompts** (DB row says bake in
  text and a JOIN TODAY button; the component default says clean photo, no
  text; a third lives in the function). Pick one architecture. Given
  `REALISM_CONSTRAINTS` forbids on-image text and the overlay path exists, the
  clean-photo-plus-overlay version is almost certainly the intended one — but
  the DB row is what actually runs today.

### Correctness (P1)

- **Idempotent push**: unique constraint on (variation, ad set), persist Meta
  creative ids. Re-pushing currently duplicates ads.
- **Persist Cloudinary image hashes.** With the template on, every push
  re-uploads the image and throws the hash away, accumulating duplicates in the
  ad account.
- Fix the `"none"` Instagram magic string — `"none"` is truthy, so it's sent to
  Meta as a literal `ig_account_id: "none"` and rejected.
- One Graph API version constant (currently v19.0 and v21.0 in different
  files), behind a small typed Meta client instead of hand-rolled
  `URLSearchParams` in five places.
- Paginate campaigns and ad sets.
- Delete storage objects when creatives are deleted (236 objects / 169 rows).
- Validate ad account id, pixel id and landing URL **at entry**, not at the
  Meta call. Zod on the server; it's already a dependency and currently unused.

### Model / AI (P1)

The app pins `claude-sonnet-4-20250514`. Current options are `claude-opus-5`
($5/$25 per Mtok) and `claude-sonnet-5` ($2/$10). At ~6K in / ~8K out per
generation run this is cents either way, so pick on quality: **Opus 5** for
copy generation, given how rule-dense the system prompt is.

Two changes that matter more than the model bump:

- **Structured outputs** (`output_config.format`) instead of regex-extracting
  the first `[...]` block out of prose. That deletes an entire class of silent
  failure — the current code has three separate parse-failure branches because
  the model sometimes wraps its JSON in commentary.
- **Prompt caching** on the system prompt. It's long, rule-dense, and identical
  across every variation request for a given industry — a textbook cache prefix.

Also replace the **Lovable AI Gateway** (platform-specific, goes away when you
leave Lovable) with direct OpenAI calls for images and direct Google for the
autofill model, using your own keys.

### Performance (P2)

- Parallelize push with bounded concurrency (Meta rate limit 613 is real and
  already bites at ad-set listing).
- Post image blobs directly to Meta instead of the 8KB-chunk
  `String.fromCharCode` base64 loop — `upload-to-facebook` already does it the
  right way; `push-to-facebook` doesn't.
- Bulk status updates as one `.in()` query, not 50 sequential PATCHes.
- Stop the pointless download-and-reupload in `saveSelectedImages`;
  `generate-images` already wrote the file to the bucket.

### Things to deliberately drop

`recharts`, `html2canvas`, `react-hook-form`, `date-fns`, `cmdk`, `embla`,
`input-otp`, `react-resizable-panels`, `vaul`, `next-themes`, `lovable-tagger`,
25 unused shadcn primitives, `NavLink.tsx`, `clubStore.accessToken`, the
unreachable PDF export, `pain_points` (0 rows, nothing writes it), fal.ai and
Perplexity remnants.

---

## 4. The one capability worth adding

**AdFlow is write-only.** It creates ads and never learns anything back. You
can generate 50 variations across six angles and have no idea which angle won,
because nothing ever reads Insights.

A nightly pull of spend / impressions / clicks / leads, keyed on the ads this
tool created, plus the stored prompt provenance from §3, would let it rank
**angles, scenes, and headline patterns by actual cost per lead** — and then
bias generation toward what works.

That is the difference between a generator and a system that gets better. It's
also strictly Phase 5 work: it depends on the provenance schema and it should
not delay the launch flow.

---

## 5. Phases

| Phase | Scope | Gate |
|---|---|---|
| **0** | Rotate credentials; disable the Lovable edge functions | Same day, independent of everything else |
| **1** | Own Supabase project; schema migration (renames, indexes, per-client brand settings, prompt tables, job tables); one-way data + storage copy | New DB verified against a snapshot of the old |
| **2** | Next.js scaffold on Vercel; auth; clients + creatives CRUD; secrets in env | Can manage clients end to end |
| **3** | Generation: copy (Opus 5, structured outputs, cached prompts) + images (direct OpenAI, streaming). **Prompt library ported verbatim first, tuned second.** | Output quality matches today's, judged side by side |
| **4** | Push and reject as resumable jobs; idempotency; real Meta previews both sides of the gate; the unified launch flow, presets, and spreadsheet copy import | One click launches 12 paused ads, from AI or from a sheet; rejecting removes them from Meta |
| **5** | Insights pull, angle/scene performance ranking | — |

Phase 3 carries the real risk. The prompt library in `SPEC.md` §6 is the
product — months of iteration on banned phrases, seasonal rules, CTA verbs,
line-5 concreteness. **Port it byte-for-byte before changing a word of it**, or
quality regresses in ways that are slow to notice and hard to attribute.

---

## 6. Decisions made

**The Lovable app is being retired, not run alongside.** Once the rebuild
ships, it is the only thing writing to Meta. Consequences:

- Phase 1 is a clean one-way migration. Copy data and storage once, verify,
  cut over. No dual-write window, no sync-back.
- Push idempotency (§3) drops from urgent to merely correct-to-have — nothing
  else will be pushing the same variations concurrently. Still build it; it
  also protects against double-clicking Launch.
- **Credential rotation in §0 is still required.** Retiring the app does not
  un-expose a token that was already readable. Rotate regardless of what
  happens to the Lovable project. The fastest way to close the hole itself is
  to delete or disable the Lovable edge functions now, since nothing depends
  on them any more.

**The review gate sits after ads exist in Meta, as PAUSED drafts.** Launch
creates everything; you review the real rendered ads and keep or kill them.
Consequences:

- The Meta client needs a **delete path** (`DELETE /{ad_id}`), which the
  current app has no equivalent of — rejecting must remove the draft from the
  ad account, not just mark a row.
- Rejection is a job too, not a fire-and-forget loop: same bounded concurrency,
  same progress, same resumability as push. A half-finished reject leaves junk
  in a client account.
- `ad_variations.status` gains a real lifecycle with a CHECK constraint —
  today it is free-text with four observed values and no constraint at all.
  Roughly: `draft → pushed → (kept | rejected)`.
- **You still preview before launching.** Review-after adds a second look; it
  does not remove the first one. Approving 12 ads into a client account sight
  unseen is not "simple", and the pre-launch preview is what tells you whether
  a batch is worth pushing at all. See §2.2 — and it should be Meta's real
  renderer, not our mockup.
- **Ads stay PAUSED throughout.** Approving in AdFlow means "keep this draft",
  never "activate it". Activation remains manual in Ads Manager
  (`SPEC.md` §9 rule 10).

## 7. Still open

1. **Which Vercel plan?** Sets the function duration ceiling in §1.
2. ~~**Is Cloudinary earning its place?**~~ **Answered: no, and it is gone.**
   It stamped a tagline bar and a promo pill onto generated photos. The
   creative that actually runs arrives already designed, with the headline,
   badge and logo laid out, so there is nothing left to stamp. Nothing in the
   rebuild ever called it. Removed from the environment and the settings
   screen; `sharp` is already a dependency and composites server-side if that
   need ever returns.
3. ~~**Solo forever, or will the team use it?**~~ **Answered: one operator now,
   the agency team later, possibly other agencies after that — but the third
   is an idea rather than a plan, with no scope attached.**

   So: build nothing for it. Binary auth where every signed-in user sees every
   client is correct for an agency team, and multi-tenancy built against an
   unknown scope produces half-isolation, which is worse than none.

   The three walls a SaaS version would hit, recorded so they are not
   rediscovered under time pressure:

   - **Meta credentials.** Tokens live in environment variables, one per
     business portfolio, because putting them in a queryable table is the
     precise defect that made the old build leak everything (§3, SPEC §8). A
     customer cannot bring their own token that way — there is no Vercel
     variable per signup. Per-tenant encrypted credential storage reopens the
     question this design closed, and is the largest piece of the work.
   - **Row-level security** is `using (true)` for authenticated users on every
     table. Fine for one team, meaningless between tenants. Adding a tenant
     column and real policies is mechanical but touches everything.
   - **The creatives bucket is public-read**, and must stay so while Meta
     fetches image URLs server-side. Across tenants that exposes one
     customer's creative to anyone holding the URL. Signed URLs solve it, at
     the cost of a refresh path on every Meta upload.

   None of this is cheaper to start now, and none of it gets harder by
   waiting. The only thing that does get harder is backfilling a tenant column
   across a large dataset, and 33 clients is not that.
4. **Which master image prompt is the intended one** (§3) — needs your call,
   since the DB row and the code default say opposite things and the DB row is
   what has actually been running.

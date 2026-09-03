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

Where the review gate sits is a real choice, and I'd want your call on it:
approve **before** anything is created in Meta (nothing junk ever touches the
account, but you're reviewing copy without seeing the real rendered ad), or
approve **after** creation as paused drafts (you review the real thing, but
rejects need cleaning up). Today it's before. Given "without me having to do
anything crazy," after is probably better — but it's your ad account.

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
| **0** | Rotate credentials, close `get_value` in the Lovable app | Same day, independent of everything else |
| **1** | Own Supabase project; schema migration (renames, indexes, per-client brand settings, prompt tables, job tables); data + storage copy | Old and new DBs agree |
| **2** | Next.js scaffold on Vercel; auth; clients + creatives CRUD; secrets in env | Can manage clients end to end |
| **3** | Generation: copy (Opus 5, structured outputs, cached prompts) + images (direct OpenAI, streaming). **Prompt library ported verbatim first, tuned second.** | Output quality matches today's, judged side by side |
| **4** | Push as a resumable job; idempotency; the unified launch flow and presets | One click launches 12 ads |
| **5** | Insights pull, angle/scene performance ranking | — |

Phase 3 carries the real risk. The prompt library in `SPEC.md` §6 is the
product — months of iteration on banned phrases, seasonal rules, CTA verbs,
line-5 concreteness. **Port it byte-for-byte before changing a word of it**, or
quality regresses in ways that are slow to notice and hard to attribute.

---

## 6. Open questions

1. **Is the Lovable app in daily use during the rebuild?** Determines whether
   we need both writing to Meta at once, and how careful Phase 1 has to be.
2. **Review gate before or after ads exist in Meta?** (§2)
3. **Solo forever, or will the team use it?** Changes how much auth and
   role modelling Phase 2 deserves. Right now there is none at all.
4. **Is Cloudinary earning its place?** It exists to stamp a tagline bar and
   promo pill on images. Next.js can composite server-side with `satori` /
   `sharp`, or the overlay can stay pure HTML in the preview. One less vendor,
   one less credential.
5. Which Vercel plan — it sets the function duration ceiling in §1.

# Handoff: AdFlow — design system, app shell, sign in, clients list, client form

## Overview
AdFlow is an internal, single-operator tool for a media buyer running Facebook/Instagram
campaigns for ~14 client businesses (boat clubs, marinas, med spas, fitness studios, home
services). It generates ad images and copy with AI, lets the operator review them, and pushes
approved creative into Facebook Ads Manager as **paused drafts**. It does not report on
performance.

This handoff covers five artboards: (1) design system, (2) app shell, (3) sign in,
(4) clients list, (5) client add/edit form. **The Launch flow (generation, review grid, push
progress) is deliberately NOT designed** — ship a placeholder nav item for it.

Product character: a professional instrument, not a consumer product. Light theme.
macOS-native reference points (Things 3, Linear, Craft), NOT apple.com marketing pages.
No hero type, no gradients, no glassmorphism, no heavy cards. Hierarchy comes from weight
and size; separation comes from hairlines and whitespace.

## About the Design Files
`AdFlow.dc.html` in this bundle is a **design reference created in HTML** — a prototype
showing intended look and behavior. It is not production code to copy directly. It is a
single streaming-component file with all styling inline, and it renders all five artboards
side by side on one canvas with state labels.

The task is to **recreate these designs in the target codebase** (React + Tailwind CSS v4,
per the project's stated stack) using that codebase's established patterns. No component
library is installed, so the primitives below (button, input, select, textarea, toggle,
checkbox, badge, table row, modal, dropdown, tooltip, toast, empty state, inline error)
need to be built. Every spec needed to build them without guessing is in this README.

Open the file in a browser to interact with it. Live behaviors in the prototype:
- Clients list: type in search, change the industry filter, click a brand row to expand/collapse,
  "Expand all brands" / "Collapse all brands", "Clear search and filter" in the empty state.
- Client form (left panel): change the Industry select to see the conditional branch swap;
  click "Auto-fill with AI" to see the thinking state resolve into tinted filled fields.
- The right-hand form panel is frozen mid-thinking on purpose so both states read side by side.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and interaction specs. Recreate
pixel-accurately. Where the prototype uses a static div to depict a native control
(select, textarea, toggle), build the real control to the same box metrics.

---

## Design Tokens

Paste into your global stylesheet. Role-named on purpose: a dark theme rebinds the same
names without renaming anything.

```css
@theme {
  /* color */
  --color-background:      #F5F5F7;  /* app canvas, sidebar */
  --color-surface:         #FFFFFF;  /* tables, panels, cards */
  --color-surface-raised:  #FFFFFF;  /* + --shadow-raised */
  --color-surface-muted:   #F0F0F2;  /* row hover, ghost button hover, chips */
  --color-border:          #E4E4E7;  /* hairlines, dividers, container borders */
  --color-border-strong:   #C9C9CE;  /* inputs, secondary button */
  --color-text-primary:    #17171A;  /* 15.4:1 on surface */
  --color-text-secondary:  #6B6B73;  /* 5.2:1 — labels, body meta, actionable ghost text */
  --color-text-tertiary:   #6E6E76;  /* 4.9:1 on surface, 4.6:1 on background — metadata */
  --color-accent:          #2E6BE6;  /* 4.6:1 on white */
  --color-accent-hover:    #2159CC;
  --color-accent-subtle:   #EAF1FE;  /* tint fill; #D3E1FC = its border */
  --color-accent-text:     #FFFFFF;
  --color-success:         #1A7F52;  --color-success-subtle: #E7F5EE;  /* text on subtle: #166B46 */
  --color-warning:         #A66300;  --color-warning-subtle: #FDF2E3;  /* text on subtle: #8A5300 */
  --color-danger:          #C0392F;  --color-danger-subtle:  #FCECEA;  /* text on subtle: #A32E25, border #F3D3CF */

  /* type — system stack, no webfont */
  --font-sans: ui-sans-serif, -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;   /* IDs only */

  /* spacing (2px base) + radius */
  --spacing: 2px;                    /* scale used: 2 4 6 8 12 16 20 24 32 40 56 */
  --radius-sm: 4px;   /* badge, checkbox, dropdown item */
  --radius-md: 6px;   /* input, button, select */
  --radius-lg: 10px;  /* surfaces, containers */
  --radius-xl: 14px;  /* modal, side panel, sign-in card */
  /* 999px: avatar, toggle, spinner */

  /* depth + motion */
  --shadow-raised:  0 1px 2px rgb(0 0 0 / .04);
  --shadow-overlay: 0 8px 24px rgb(0 0 0 / .10), 0 1px 2px rgb(0 0 0 / .06);
  --shadow-modal:   0 24px 60px rgb(0 0 0 / .16), 0 1px 2px rgb(0 0 0 / .06);
  --shadow-panel:   -16px 0 40px rgb(0 0 0 / .10);   /* right side panel */
  --ring-focus:     0 0 0 3px rgb(46 107 230 / .28);
  --ring-focus-danger: 0 0 0 3px rgb(192 57 47 / .18);
  --ease-out: cubic-bezier(.2,.8,.3,1);   /* 150ms controls · 180-200ms panels */
}
```

### Dark theme (later, same names)
background #0E0E10 · surface #17171A · surface-muted #232327 · border #2A2A2F ·
border-strong #3A3A40 · text-primary #F2F2F4 · text-secondary #A0A0A8 ·
text-tertiary #86868E · accent #5B8DF5 · accent-subtle #16233D. Nothing renames.

### Type scale (each step named by use)
| Step | Size | Weight | Line-height | Tracking | Used for |
|---|---|---|---|---|---|
| display | 32px | 700 | 1.15 | -0.02em | sign-in product name only |
| title | 20px | 600 | 1.25 | -0.01em | page title ("Clients") |
| heading | 17px | 600 | 1.35 | 0 | panel / modal title |
| lead | 15px | 600 | 1.45 | 0 | section titles, empty-state title |
| body | 14px | 400 | 1.55 | 0 | prose, shell nav item (550) |
| data | 13px | 400 | 1.45 | 0 | table cells, inputs, buttons (550) |
| label | 12px | 550 | 1.35 | 0 | field labels, secondary meta |
| caption | 11px | 600 | 1.30 | 0.04em | column heads (uppercase), badges, hints |

`font-variant-numeric: tabular-nums` on all IDs, counts and result labels.
Facebook/pixel/ad-account IDs render in `--font-mono`.
Section-group headers inside the form: 11px / 600 / uppercase / 0.05em / text-tertiary.

---

## Component specs (default / hover / focus / disabled)

**Button** — height 32px, radius 6, 13px/550, padding 0 12 (ghost 0 10),
transition `background 150ms var(--ease-out)`.
Focus for all variants: `box-shadow: 0 0 0 1px #FFF, var(--ring-focus)` (danger uses the danger ring).
Disabled for all variants: `opacity: .45; cursor: not-allowed` — no color change.

| Variant | Default | Hover |
|---|---|---|
| Primary | bg accent, border accent, text #FFF | bg + border accent-hover |
| Secondary | bg surface, border border-strong, text primary | bg background (#F5F5F7) |
| Ghost | transparent, no border, text secondary | bg surface-muted, text primary |
| Danger | bg surface, border #E7C6C2, text danger | bg danger, border danger, text #FFF |

A small in-row action button (table Edit/Delete) is 26px tall, padding 0 8, 12px/550,
radius 5; Delete hovers to bg danger-subtle + text #A32E25.

**Text input / select / textarea** — height 34px (textarea min-height 56–72, padding 8/10),
radius 6, 1px border-strong, padding 0 10px, 13px, bg surface, no outline.
- focus: border accent + `var(--ring-focus)`
- invalid: border danger + `var(--ring-focus-danger)`, inline error below
- disabled: border `--color-border`, bg background, text tertiary
- filled-by-AI: bg #F7FAFF, cleared on any user edit
- label above, 12px/550 secondary, 6px gap; required marker is a danger-colored `*`
- Select chevron ▾ 10px tertiary, right-aligned.

**Inline error** — 12px (11px inside dense grids), color #A32E25, 5px gap, leading bold `!`
glyph, 1.4 line-height, sits directly under the field.

**Dropdown / menu** — surface, 1px border, radius 8, `--shadow-overlay`, 4px padding;
items 28px tall, padding 0 8, radius 4, 13px; selected item bg surface-muted + accent ✓;
offset 4px below the trigger.

**Toggle** — 38×22 track, radius 999, 2px padding; knob 18px white with
`0 1px 2px rgb(0 0 0 / .2)`. On: track accent, knob right. Off: track #D6D6DB, knob left.
Transition 150ms ease-out on background + transform.

**Checkbox** — 16×16, radius 4. Checked: bg accent, white ✓ 11px. Unchecked: 1px
border-strong on surface. Focus adds `var(--ring-focus)`.

**Badge** — height 20px, padding 0 7, radius 4, 11px/600, 5px icon gap.
Status badges pair a **shape glyph with a word** so they survive greyscale and color-blindness:
- Connected → `●` (9px) on success-subtle, text #166B46
- No ad account → `▲` (10px) on warning-subtle, text #8A5300
- Token expired → `!` (bold) on danger-subtle, text #A32E25
- Neutral count ("4 locations") → surface-muted, text secondary
- Draft → accent-subtle, text accent-hover

**Table row** — 44px default height (density control 36–56), `0 24px` padding,
1px #F0F0F2 bottom hairline, no zebra. Hover bg surface-muted; expanded parent row bg #FAFAFB.
Header row: 8px vertical padding, bg #FAFAFB, 1px border bottom, caption type, tertiary.
Grid template: `1fr 130px 190px 150px 90px` (Client / Industry / Market / Ad account / actions),
12px gap.

**Card / surface** — bg surface, 1px `--color-border`, radius 10, `--shadow-raised`. That
is the only elevation used in-page. No nested cards.

**Modal** — 380px wide, radius 14, 20px padding, `--shadow-modal`, scrim
`rgb(23 23 26 / .28)`. Reserved for destructive confirmation only. Title 17/600, body
13/1.5 secondary, actions bottom-right with 8px gap, 12px above.

**Tooltip** — bg #17171A, text #FFF, 11px/1.35, padding 5px 8px, radius 5, max-width 200px,
appears after ~400ms on the collapsed sidebar icons and on ID field labels.

**Toast** — bg #17171A, text #FFF, radius 8, padding 10px 12px, `--shadow-overlay`,
success glyph #6FD1A0, optional "Undo" in #9B9BA3, bottom-center, auto-dismiss 6s.

**Empty state** — centered column, 56px vertical padding, 6px gap: 34px icon tile
(radius 9, bg accent-subtle, accent glyph), title 15/600, body 13/1.5 secondary
max-width ~320px, then one action 12px below.

**Loading** — skeleton bars that preserve row rhythm; 11px tall, radius 3, background
`linear-gradient(90deg,#F0F0F2,#E7E7EA 40%,#F0F0F2 80%)` sized 280px, animated
`shimmer 1.3s linear infinite` (background-position -200px → 280px). No spinners in tables.
Spinners only inside the AI action strip: 14px circle, 2px border #B9CFF7 with
border-top accent, `spin .7s linear infinite`.

---

## Screens

### 02 App shell
**Purpose:** persistent frame for every view. One signed-in operator.

**Layout:** sidebar (fixed width) + content column. Sidebar bg background, 1px right border,
padding 12px 10px. Content column: 52px top bar (1px bottom border, 0 32px padding) over a
background-colored body with 24px/32px padding and content max-width 1120px.

**Sidebar, expanded (220px):** brand row = 20px accent rounded square (radius 5) + "AdFlow"
14/600, with a collapse chevron `⟨` (tertiary) at the right; 14px space below.
Nav items: 30px tall, padding 0 8, radius 6, 9px gap, 13px/550, 15px stroke icon
(stroke-width 1.8, round caps, opacity .9), optional right-aligned count in 11/600 tertiary
tabular. Active item: bg #E7E7EA, text primary. Inactive: transparent, text secondary,
hover bg surface-muted.
Four items in order: **Clients** (count 14), **Creatives** (count 38), **Launch**
(placeholder — route exists, page is a stub), **Settings**.
Footer pinned bottom, 1px top border, 10px padding-top: 24px round avatar
(bg #D9E3F7, text #2159CC, 11/650 initials) + name 12/550 + "Sign out" 11px in
text-secondary (it is actionable, so it must not use tertiary).

**Collapsed (52px):** icons only, 32×30 hit areas centered, brand square retained, avatar
retained in the footer, labels reappear as tooltips. Width animates 200ms ease-out.

**Narrow window (≤1024px):** sidebar auto-collapses to 44px, top bar 48px with 16px gutter,
primary action label shortens ("Add"), table drops the Market column and shows status as a
bare glyph with an accessible label. Nothing below ~1024px is optimized further; nothing breaks.

### 03 Sign in
**Purpose:** the only unauthenticated screen. Accounts are created by hand — there is no
sign-up link, no social auth, no password reset in this build.

**Layout:** background-colored full page, card centered both axes. Card 340px, surface,
1px border, radius 14, `--shadow-raised`, 28px padding, 18px section gap.
Header: 24px accent rounded square (radius 6), "AdFlow" 20/600 (-0.01em) 6px below,
"Sign in to continue." 13px secondary. Fields Email then Password, 12px gap, standard input
spec. Primary button full-width, 36px tall, 13/600.

**Error state:** a single banner between header and fields — bg danger-subtle, 1px #F3D3CF,
radius 6, 8px/10px padding, bold `!` + 12px/1.45 text #A32E25:
"Email or password is incorrect. Two attempts left before a 60-second lockout."
Email keeps its value; password is cleared and carries the invalid border + danger ring.
Never mark which of the two fields was wrong. Lock out for 60s after 3 failures.

### 04 Clients list
**Purpose:** the home view. Find a client, check whether it is connected to an ad account,
edit or delete it, add a new one. Holds 80+ rows comfortably.

**Header block** (24px padding, 1px bottom border): page title "Clients" 20/600 with a
primary "Add Client" pushed right. Below it a 10px-gap control row: search input
(32px tall, 280px wide, placeholder "Search name, location or URL"), industry select
(All industries / Boat Club / Marina / Med Spa / Fitness / Real Estate / Home Services),
result count "12 of 14" in 12px secondary tabular, and a right-aligned
"Expand all brands" / "Collapse all brands" ghost text action.

**Search** matches client name, location description and landing page URL. Filter and search
compose (AND).

**Brand grouping — the important detail.** Several clients belong to one brand at different
locations (e.g. Carefree Boat Club × 4, Freedom Boat Club × 3).
- A brand with **>1 location** renders as a **parent row**: brand name 13/600, a neutral
  "4 locations" badge, industry, "4 markets" in the Market column, and an aggregate status
  badge ("All connected", or "3 of 4" with the warning treatment). Chevron `▸` collapsed /
  `▾` expanded in a 12px slot; the whole row toggles. Expanded parent row gets bg #FAFAFB.
- Children render **indented 22px**, name = location only ("Lake Norman"), 13/400, with
  their own market and status.
- A brand with **one** location renders as a **plain row** — no chevron, no badge, name
  13/500.
- When a search query is active, matching children are revealed regardless of collapse state.

**Row actions:** ghost "Edit" (opens the side panel) and "Delete" (opens the confirm modal),
right-aligned, revealed on row hover and always present for keyboard users.

**Three distinct non-happy states — they must not look alike:**
1. **Loading** — header + column heads render immediately; 5+ skeleton rows keep the 44px
   rhythm. No spinner.
2. **No clients yet** — accent-subtle `＋` tile, "No clients yet",
   "Add a business and AdFlow can generate its first batch of creative. Clients with several
   locations get grouped under one brand automatically.", primary "Add Client". **Invites you
   to add.**
3. **Nothing matched** — no icon tile, title quotes the query
   ("Nothing matched \u201Cmarina\u201D"), body explains the search scope
   ("Search covers client name, location description and landing page URL. Try a shorter term
   or widen the industry filter."), single secondary button "Clear search and filter".
   **Invites you to change the filter.** Count reads "0 of 14".

### 05 Client add / edit form

**Container decision: right side panel, 460px — not a modal.** Rationale to preserve:
the form is 12–16 fields with a conditional branch; a centered modal that tall either scrolls
inside a floating box or fills the viewport, and both feel wrong for a task repeated daily.
A right-edge panel keeps the client list visible behind it (the operator is often copying an
ID from a sibling location), gives a fixed measure so labels and inputs never reflow, and lets
header and footer pin while only the body scrolls. Modals stay reserved for destructive
confirmation.

**Structure:** scrim `rgb(23 23 26 / .28)`; panel full height, right-aligned, 460px, surface,
1px left border, `--shadow-panel`. Enters with transform translateX(100%) → 0 over 200ms
ease-out; scrim fades over 150ms. Esc closes; a dirty form asks before discarding.
- **Header (sticky, flex:none):** 16px/20px padding, 1px bottom border. Title 17/600
  ("Edit client" / "Add client"), sub-line 12px tertiary (client name, or
  "New business · not yet connected"), ghost 28×28 `✕` right.
- **Body (scrolls):** 18px/20px/24px padding, 22px gap between groups, 12px within a group,
  1px #F0F0F2 divider between groups.
- **Footer (sticky, flex:none):** 12px/20px padding, 1px top border, bg surface. Left: ghost
  "Delete" in danger (edit mode only) or "N fields need attention" in 11px tertiary.
  Right: secondary "Cancel" + primary "Save client" (disabled while invalid).

**Field order — exactly this:**
1. **Industry** (select): Boat Club, Marina, Med Spa, Fitness, Real Estate, Home Services, Other
2. **Marina business type** (select) — *only when Industry = Marina*: Boat Rentals, Wet Slips,
   Dry Storage, Storage & Slips, Full Service
3. **Client Name** — required
4. **Location Description**
5. **Facebook Page ID** — mono, tabular
6. **Ad Account ID** — mono; **must begin `act_`**; invalid shows border danger + danger ring
   + inline error "Must begin with `act_` — try `act_1092447731`" (echo the corrected value)
7. **Landing Page URL**
8. **Facebook Pixel ID** — mono, tabular
9. **Branch — Industry = Boat Club:** Season Type (Seasonal / Year-Round, segmented control:
   34px tall, 1px border-strong, radius 6, halves split by a 1px divider; selected half
   bg accent-subtle + text accent-hover, 12/550), Market Name, Boating Style, Environment Style.
   Section header carries an accent-subtle "Boat Club only" badge.
10. **Branch — every other industry:** "What does this business sell?" (textarea),
    "Offer / what the ad drives to" (input), "Tone Keywords" (chip input: 22px chips,
    radius 4, surface-muted, per-chip `✕`, trailing "add…" affordance; AI-filled chips use
    accent-subtle). Section header carries a neutral "Non-boat-club branch" badge.
11. **Current Promotion** (textarea) — always last, with 11px tertiary hint
    "Injected verbatim into generated copy. Leave blank when nothing is running."

**Grouping used in the design:** Classification (1–2) · Identity (3–4) ·
Meta connection (5–8, with Page ID and Ad Account ID side by side in a 2-col 12px-gap grid) ·
branch voice section (9 or 10) · Current Promotion.

**Conditional fields — how they read without the layout jumping.** Revealed fields animate
`fadeUp 180ms var(--ease-out)` (opacity 0→1, translateY -3px→0) *in place*; they do not
animate height. The panel is a fixed-width scroll container, so appearing fields push
content down within the scroll region rather than resizing the container — nothing outside
the panel moves, and the sticky header/footer never shift. Conditional groups sit at
section boundaries (never mid-group) so a reveal reads as "a section appeared", not
"a row was injected". Removing a branch keeps its values in state for the session, so
toggling Industry back restores them.

**Auto-fill with AI.** An accent-subtle strip at the top of the body (1px #D3E1FC, radius 8,
9px/11px padding): explanatory 12px accent-hover text + a 28px primary button
"Auto-fill with AI". It populates Location Description, Facebook Page ID, Facebook Pixel ID,
Market Name and the voice fields from client name + location.
- **Idle:** button reads "Auto-fill with AI".
- **Thinking:** button label becomes "Thinking…"; the strip shows the 14px spinner, the copy
  becomes progress narration ("Reading harborpointmarina.com and Meta Business Manager —
  filling market, pixel and voice fields."), and a "Stop" text action appears. Fields being
  filled show the shimmer treatment at full field height (34px, radius 6, gradient
  #F5F5F7/#ECECEF). Other fields stay editable throughout.
- **Done:** filled fields get bg #F7FAFF and an 11px accent-hover note "Tinted fields were
  filled by Auto-fill — edit any of them and the tint clears." Editing a field clears its tint.
- **Failure (not drawn):** strip switches to danger-subtle with the `!` glyph and a "Retry"
  action; no fields change.

---

## Interactions & Behavior
- All control transitions 150ms `--ease-out`; panels and sidebar width 200ms; field reveal
  180ms. Nothing bounces, nothing scales, no spring.
- Row hover changes only background. Chevron rotates 150ms.
- Table sorting is not in scope; default order is brand A→Z with locations in setup order.
- Delete always routes through the confirm modal; copy names the client and states
  "Its 38 generated creatives stay in Ads Manager. This only removes the client from AdFlow."
  Success emits the toast with Undo.
- Validation runs on blur and on submit, never on keystroke. Save stays disabled while any
  field is invalid, with the footer count as the explanation.
- Responsive: works 1280px → ~1024px. Sidebar auto-collapses at 1024; the clients table drops
  Market first, then Industry. Mobile is not a priority but must not break — the panel goes
  full-width below ~640px.

## State Management
Clients view: `query: string`, `industryFilter: string`, `expandedBrands: Record<string, boolean>`,
`status: 'loading' | 'ready'`, `clients: Client[]`.
Derived, not stored: grouped rows (parent/child/plain), `shownCount`/`totalCount`,
whether any brand is expanded (drives the Expand/Collapse-all label), and which empty state
applies (`totalCount === 0` → "no clients yet"; `shownCount === 0 && totalCount > 0` →
"nothing matched").
Panel: `mode: 'add' | 'edit'`, `values`, `dirty`, `errors`, `aiState: 'idle' | 'busy' | 'done' | 'error'`,
`aiFilledFields: Set<string>`.
Data: list fetch on mount; save is a single PUT/POST returning the updated client; Auto-fill is
one async call that resolves a partial values object.

`Client`: id, brandName, locationName | null, industry, marinaBusinessType?, locationDescription,
facebookPageId, adAccountId, landingPageUrl, facebookPixelId, seasonType?, marketName?,
boatingStyle?, environmentStyle?, sells?, offer?, toneKeywords?: string[], currentPromotion,
adAccountConnected: boolean. Brand grouping is derived by `brandName`.

## Accessibility
- WCAG AA throughout: 4.5:1 body, 3:1 large. text-tertiary (#6E6E76) is 4.9:1 on surface and
  4.6:1 on background; do not lighten it. Actionable text (e.g. "Sign out") uses
  text-secondary, never tertiary.
- Focus is visible and never color-only: every focusable control gets the 3px ring **plus** a
  border-color change; the ring is drawn with a 1px white spacer so it reads on tinted rows.
- Status is never color-only — every status badge pairs a distinct glyph shape (● / ▲ / !)
  with a word.
- Parent brand rows are `<button>`-semantics rows with `aria-expanded`; children are
  associated via `aria-level`/`aria-owns` in a treegrid, or a plain grouped table with a
  visually-hidden "in brand X" label.
- The side panel is a focus-trapped dialog: `role="dialog" aria-modal="true"`, focus moves to
  the first field, Esc closes, focus returns to the invoking row.
- Inline errors are `aria-describedby` on their field; the invalid field gets `aria-invalid`.
- Auto-fill progress and completion announce via an `aria-live="polite"` region.

## Assets
None. No images, no icon library, no webfont. Four nav icons are inline 24-viewBox SVG
strokes (currentColor, stroke-width 1.8, round caps) — Clients (people), Creatives (image),
Launch (send), Settings (sliders); their exact path data is in the prototype's logic under
`nav`. Glyphs used as text: ▾ ▸ ✓ ✕ ＋ ● ▲ ! ⟨. Swap them for your icon set if you have one,
keeping the shape distinctions in the status badges.

## Files
- `screenshots/01-design-system.png`, `02-app-shell.png`, `03-sign-in.png`,
  `04-clients-list.png`, `05-client-form.png` — 2x captures of each artboard as rendered.
  Reference only; the HTML file is authoritative for exact values.
- `AdFlow.dc.html` — all five artboards, interactive. Artboards are labeled
  `data-screen-label`: "01 Design system", "02 App shell", "03 Sign in", "04 Clients list",
  "05 Client form". The design-system artboard contains the pasteable `@theme` block, the
  color grid with contrast notes, the type/spacing/radius scales, and the full component
  state matrices.

## Out of scope — do not design or build from guesswork
The **Launch** flow (AI generation, review grid, push-to-Ads-Manager progress) is intentionally
absent. Ship the nav item and a stub page; it will be specified once its states are settled.

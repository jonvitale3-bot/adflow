# AdFlow — design brief

Hand this to Claude Design. It is written to stand alone; assume the designer
knows nothing about this project.

---

## What AdFlow is

An internal tool for a media buyer who runs Facebook and Instagram ad
campaigns for around 14 client businesses — boat clubs, marinas, med spas,
fitness studios, home services.

It generates ad images and ad copy with AI, lets the operator review them, and
pushes the approved ones into Facebook Ads Manager as paused draft ads. It does
not report on ad performance; it creates and publishes ads.

**One user.** The owner, signed in, using it most days. This is a professional
instrument, not a consumer product and not a marketing site.

---

## The look

**Light theme.** The current build is dark and the owner finds it tiring to
work in. Light, calm, high contrast.

**"Apple-esque" — but the right Apple.** Not apple.com marketing pages: no
enormous hero type, no huge scroll rhythm, no product photography energy. Think
**macOS system apps and the best Mac-native software** — Things 3, Linear,
Craft, Notion's quieter corners. That means:

- Restrained, near-neutral palette. One accent color, used sparingly and with
  intent. Color carries meaning here, it is not decoration.
- Generous but *disciplined* whitespace. This screen holds real data and the
  operator scans it daily — air between groups, tight within them. Do not
  space it out like a landing page.
- Typographic hierarchy doing the heavy lifting: weight and size, not boxes,
  borders, and dividers everywhere.
- Depth used almost never. A hairline border or a very soft shadow to lift a
  surface — no heavy cards, no gradients, no glassmorphism.
- Corners softly rounded and consistent. Pick one radius scale and hold it.
- Motion minimal and quick. 150–200ms, ease-out. Nothing bounces.

**Density matters.** The client list can hold 80+ rows. It should feel
comfortable to scan, not airy to the point of scrolling forever.

---

## Deliverables

Please produce these artboards:

### 1. Design system

The foundation everything else inherits.

- **Color tokens**, named by role not by hue: background, surface, surface
  raised, border, border strong, text primary, text secondary, text tertiary,
  accent, accent text, success, warning, danger. Give hex values.
- **Type scale** — family, sizes, weights, line heights. Name each step by use
  (page title, section title, body, label, caption, numeric).
- **Spacing scale** and the **radius scale**.
- **Components**, each with default / hover / focus / disabled where relevant:
  buttons (primary, secondary, ghost, danger), text input, select, textarea,
  toggle, checkbox, badge/pill, table row, card, modal, dropdown menu, tooltip,
  empty state, inline error, toast.

### 2. App shell

Persistent left sidebar navigation, collapsible to icons. Four items:

- **Clients**
- **Creatives**
- **Launch**
- **Settings**

Sidebar footer holds the signed-in user and a sign-out control. Show the shell
expanded and collapsed, and show what it becomes on a narrow window.

### 3. Sign in

Single centered card. Product name, email field, password field, one primary
button. **No sign-up link** — accounts are created by hand, deliberately. Show
the error state (bad credentials) as well as the resting state.

### 4. Clients — list

The main screen. Elements:

- Page title, and a primary "Add Client" button.
- A search field (matches name, location, landing page URL).
- An industry filter.
- A result count, e.g. "12 of 14".

**Rows group by brand, and this is the important detail.** Several clients
belong to one brand at different locations — for example "Carefree Boat Club"
might have four. A brand with multiple locations renders as a **parent row**
showing the brand name and "4 locations", which expands to reveal **indented
child rows**, one per location. A client with no siblings renders as a single
plain row. Show a group both collapsed and expanded.

Each row shows: name, industry, market/location, and whether it is connected to
a Facebook ad account. Row actions: edit, delete.

Also design: the loading state, the "no clients yet" empty state, and the
"nothing matched your search" empty state. These should not look identical —
one invites you to add something, the other suggests changing the filter.

### 5. Client — add / edit form

A modal or a side panel; your call, but justify it. It is a long form, so
consider grouped sections rather than one undifferentiated column.

Fields in order:

1. **Industry** — select: Boat Club, Marina, Med Spa, Fitness, Real Estate,
   Home Services, Other
2. **Marina Business Type** — *appears only when Industry is Marina*: Boat
   Rentals, Wet Slips, Dry Storage, Storage & Slips, Full Service
3. **Client Name** (required)
4. **Location Description**
5. **Facebook Page ID**
6. **Ad Account ID** — must begin with `act_`; show the invalid state
7. **Landing Page URL**
8. **Facebook Pixel ID**

Then a branch:

- **When Industry is Boat Club:** Season Type (Seasonal / Year-Round),
  Market Name, Boating Style, Environment Style
- **Otherwise:** What does this business sell?, Offer / what the ad drives to,
  Tone Keywords

Then:

9. **Current Promotion** — free text

Please show the form in **two states**: Industry = Boat Club, and Industry =
Marina (so both conditional branches are visible). Conditional fields appearing
and disappearing is central to this form — show how that reads without the
layout feeling like it jumps.

There is also an **"Auto-fill with AI"** action that populates several fields
from the business name and location. Show it, and show what the form looks like
while it is thinking.

---

## Please do not design yet

The **Launch** flow — generation, the review grid, push progress — is being
designed later, once its behavior is built and its states are known. Designing
it now would be guessing. A placeholder for the Launch nav item is fine.

---

## Technical constraints

- **Tailwind CSS v4** and React. Tokens will be mapped into Tailwind's `@theme`
  block, so please express color, spacing, radius, and type as named tokens
  with concrete values.
- **No component library is installed.** Components will be built from your
  specs, so specs should be complete enough to implement without guessing —
  include padding, border widths, focus rings, and disabled treatment.
- Design **light only** for now, but choose tokens that could invert to a dark
  theme later without renaming anything.
- System font stack is fine and probably correct here. If you want a specific
  face, name a Google Fonts family and a fallback stack.
- Everything must work from roughly 1280px down to a narrow laptop window. Full
  mobile is not a priority — this is desktop work — but nothing should break.

## Accessibility

Text must meet WCAG AA contrast (4.5:1 for body, 3:1 for large text). Focus
states must be visible and not rely on color alone. Status must never be
conveyed by color alone — pair it with a label or an icon.

## What to hand back

The artboards, plus the token values in a form that can be pasted into code
(a table or a CSS custom-property block is ideal). If you produce component
code, React with Tailwind v4 utility classes is what it will be implemented in.

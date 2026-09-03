# Prompt to paste into Lovable

## Before you paste

1. **Switch Lovable to Chat mode (not Build/Edit mode).** This makes the agent
   read and answer instead of writing code. It costs far fewer credits and it
   won't touch your working app.
2. Paste the prompt below as a single message.
3. Paste the whole reply back to Claude Code.

If the reply gets truncated, say "continue from section 5" and paste the rest.

## Even better than this prompt

Lovable can sync a project to GitHub (Project Settings → GitHub → Connect).
If you connect the ad tool to a repo and give Claude Code access to it, Claude
reads the actual source instead of a description of it — no detail lost, no
hallucinated file names. Do both if you can: the repo gives the code, this
prompt gives the *intent* and the runtime config that code alone doesn't show.

---

## The prompt

```
READ-ONLY TASK. Do not modify, create, or delete any files. Do not refactor
anything. Do not "improve" anything. Your entire output is a document in chat.

I am migrating this project to a separate codebase. Write a complete technical
handover spec for an engineer who has never seen this project and will never
have access to it or to you.

Rules for your answer:
- Be exhaustive. Detail over brevity. A long answer is the correct answer.
- Name real things: real file paths, real table names, real column names, real
  function names, real component names. No generic placeholders.
- If you do not know something, write "UNKNOWN" for it. Never guess or invent.
- Never print the VALUE of any secret, API key, token, or password. Print the
  NAME of the env var / secret only.

Produce these sections, in this order:

## 1. PRODUCT
- One paragraph: what this app does and who uses it.
- The core user journeys, start to finish, step by step (aim for 3-6).
- Every user role/persona, and exactly what each one can and cannot do.
- What this does that a generic reporting dashboard would not.

## 2. ROUTES & SCREENS
For every route: the path, the component that renders it, and whether it is
public, auth-gated, or token-gated. Then for each screen: what is on it, the
key interactions, and its loading / empty / error states.

## 3. FRONTEND ARCHITECTURE
- Full file tree of src/, with a one-line purpose note per directory.
- The 15-20 most important components: name, file path, one-line job, key props.
- State management: what is server state vs client state, how react-query (or
  equivalent) is used, every context/store and what lives in it.
- Forms and validation approach.
- Libraries used for charts, tables, dates, PDF/CSV export, drag-drop, etc, and
  where each is used.
- Styling: Tailwind config, design tokens, theme, dark mode, any custom CSS,
  which shadcn/ui components are actually in use.
- The full dependency list from package.json, each with one line on why it's there.

## 4. BACKEND / DATABASE
- The Supabase project ref and region.
- The complete SQL schema. Every table: every column with its type, default,
  nullability, and constraints. Every index. Every foreign key.
- Every RLS policy, verbatim: table, policy name, command, role, and the exact
  USING / WITH CHECK expressions.
- Every database function, trigger, view, materialized view, and enum, with source.
- Every scheduled job (pg_cron or otherwise): schedule expression and what it calls.
- Storage buckets: name, public or private, policies, what is stored in each.
- Auth: which providers, how a user's role/permission is determined, any custom
  claims or profile/role tables.

## 5. EDGE FUNCTIONS
For each edge function: its slug, what it does in plain English, the HTTP method
and exact request body/params it expects, the exact response shape it returns,
its verify_jwt setting, which secrets it reads, which external APIs it calls,
and then its FULL SOURCE CODE.

## 6. EXTERNAL INTEGRATIONS
Every third-party service (ad platform APIs and their version numbers, AI model
providers and the exact model IDs, email, storage, analytics, anything else).
For each: what it is used for, which specific endpoints, the auth model, rate
limits you actually hit, and any quirks you had to work around.
Then: the NAMES of every secret and env var the project needs. Names only.

## 7. DATA FLOW & CALCULATIONS
- How data enters the system (syncs, imports, manual entry) and on what schedule.
- Backfill, dedupe, upsert, and retry logic.
- The EXACT formula for every derived or displayed metric — CPL, CPC, CTR, CPM,
  ROAS, conversion rate, budget pacing, period-over-period deltas, anything else.
  Include how you handle divide-by-zero, missing days, currency, and timezone.
- Any caching layer and its invalidation rules.

## 8. THE HARD PARTS
- What took the most iterations to get right, and why.
- Every known bug, broken feature, or thing that only half-works.
- Every hack, workaround, hardcoded value, magic string, or "temporary" fix
  still in the code.
- What is slow, and specifically where.
- What you would build differently if starting over today.

## 9. NON-OBVIOUS RULES
Business rules and edge cases that are NOT inferable from the schema or the
code — the things a rewrite would silently get wrong. Be specific and list as
many as you can.

## 10. WHAT I DID NOT COVER
Anything you were unsure about, could not inspect, or deliberately skipped.
```

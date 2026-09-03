# adflow

Rebuild of an ad-generation tool prototyped in Lovable, targeting Vercel.

AdFlow generates Meta (Facebook/Instagram) ad creative and copy with AI, gates
it behind human approval, and pushes approved ads into existing campaigns as
PAUSED drafts via the Marketing API. It writes to Meta; it does not report on
Meta.

## Docs

| File | What it is |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Handover spec for the existing Lovable build — schema, edge functions, the prompt library, known defects, and the 27 non-obvious business rules a rewrite would silently get wrong. **Source of truth.** |
| [`docs/PLAN.md`](docs/PLAN.md) | Rebuild plan: target architecture, the workflow simplification, fixes, and phasing. |
| [`docs/LOVABLE-EXPORT-PROMPT.md`](docs/LOVABLE-EXPORT-PROMPT.md) | The read-only prompt used to extract the spec out of Lovable. |

## Status

Planning. No application code yet.

**Before any of this:** `docs/PLAN.md` §0 describes a live credential exposure
in the existing Lovable app that needs handling independently of the rebuild.

## Stack

Next.js (App Router) on Vercel, Supabase for data/auth/storage. See
`docs/PLAN.md` §1 for the reasoning.

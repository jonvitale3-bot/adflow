# Supabase project

| | |
|---|---|
| Project ref | `cgomtswediridynfybkj` |
| Region | `us-east-1` (co-located with Vercel's default `iad1`) |
| Org | `jonvitale3-bot's Org` |
| API URL | `https://cgomtswediridynfybkj.supabase.co` |

This replaces the Lovable-managed project (`mremzsrvcpxlrixsginc`), which was
never in the owner's own org.

## Environment

Publishable and anon keys are **not secrets** — they are designed to ship to
the browser and RLS governs what they can reach. They are recorded here so the
app can be configured without a dashboard round-trip.

```
NEXT_PUBLIC_SUPABASE_URL=https://cgomtswediridynfybkj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_3eUowOjpeG6pZy8JgevqHQ_yT8dAji4
```

The **service role key is a secret** and is deliberately not in this repo.
Get it from Dashboard → Project Settings → API → `service_role`, and set it in
Vercel and in your local `.env.local` only:

```
SUPABASE_SERVICE_ROLE_KEY=<from the dashboard>
```

## Migrations

`supabase/migrations/0001_init.sql` is applied. It was validated against a
throwaway Postgres 16 before being applied here, and the project reports zero
security advisories.

Schema notes are in `PLAN.md` §3 and the migration's own header comment.

## Auth

Not yet configured. Before the app is usable:

1. Dashboard → Authentication → Providers → Email: enable, and **disable
   signups** (this is a single-operator tool).
2. Create the operator user manually under Authentication → Users.
3. Leave confirm-email on unless SMTP is unconfigured, in which case use
   "Auto Confirm User" when creating the account by hand.

There is no sign-up route in the app by design.

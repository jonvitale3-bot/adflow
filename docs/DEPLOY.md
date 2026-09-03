# Deploying to Vercel

## One-time setup

1. **vercel.com → Add New → Project → Import** `jonvitale3-bot/adflow`.
2. Framework preset detects **Next.js**. Leave build settings alone.
3. Add the environment variables below **before** the first deploy — the app
   validates its environment at startup (`lib/env.ts`) and will fail the build
   rather than boot half-configured. That is deliberate.
4. Deploy.

Functions are pinned to `iad1` in `vercel.json`, the same region as the
Supabase project (`us-east-1`). The push flow does many sequential database
writes per ad, so co-location is worth the one line.

## Environment variables

Set these in **Project → Settings → Environment Variables**, for Production,
Preview, and Development.

### Required now

| Variable | Where it comes from | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `docs/SUPABASE.md` | No |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `docs/SUPABASE.md` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` | **Yes** |

`NEXT_PUBLIC_*` variables are compiled into the browser bundle. Never put a
secret behind that prefix.

### Required before Phase 3 (generation)

| Variable | Where it comes from |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys |
| `OPENAI_API_KEY` | platform.openai.com → API keys |

### Required before Phase 4 (push)

| Variable | Where it comes from |
|---|---|
| `META_ACCESS_TOKEN` | Business Settings → Users → System Users → Generate Token |
| `META_APP_ID` | App Dashboard → Settings → Basic (optional) |
| `META_APP_SECRET` | App Dashboard → Settings → Basic (optional) |

`META_GRAPH_VERSION` defaults to `v21.0` and only needs setting to override it.

## Function duration

Image generation runs ~40–60s per image and ~150s for a batch of twelve; a push
of twenty ads runs for minutes. Neither fits Vercel's default timeout.

Set it per route in the App Router, not globally:

```ts
// app/api/generate/images/route.ts
export const maxDuration = 300; // seconds
```

The ceiling depends on plan — Hobby is far lower than Pro. **Check the current
limit for your plan before relying on a value.** The architecture does not
depend on winning this argument:

- Image generation streams, so a disconnect loses nothing already written.
- Push is a job with per-item rows, so a timeout is a resumable interruption
  rather than an unrecoverable partial push. The worker route can be re-invoked
  and picks up where it stopped.

## Branches

Vercel builds `main` for Production and every other branch as a Preview
deployment with its own URL. Preview deployments share the same environment
variables unless scoped otherwise — which means a preview can write to the
production database. Keep that in mind before pointing anything at a real ad
account.

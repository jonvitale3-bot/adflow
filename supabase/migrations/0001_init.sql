-- AdFlow schema, rebuilt.
--
-- Diverges from the Lovable schema (docs/SPEC.md §4) deliberately:
--   * clubs -> clients, club_id -> client_id (every non-boating client read as
--     a "club" in the old code)
--   * brand_settings goes per-client; it was ONE GLOBAL ROW applied to every
--     client, so a med spa inherited Carefree's brand voice
--   * free-text taxonomy columns become enums, so the frontend list, the scene
--     banks and the prompt templates cannot drift apart
--   * prompt templates become versioned rows, and the rendered prompt is
--     stored on whatever it produced (previously the prompt existed only in
--     edge-function logs, so you could not tell what made an image)
--   * indexes on every client_id (there were none, on any table)
--   * launches modelled as resumable jobs rather than one long request
--   * updated_at maintained by trigger (previously by hand, or not at all)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type industry as enum (
  'boat_club', 'marina', 'med_spa', 'fitness', 'real_estate',
  'home_services', 'other'
);

-- Without this, industry='marina' falls through to the bland generic prompt.
-- The subtype selects both the prompt template and the scene bank.
create type marine_business_type as enum (
  'boat_rentals', 'wet_slips', 'dry_storage', 'storage_slips', 'full_service'
);

-- 'year_round' bans ALL seasonal urgency framing (docs/SPEC.md §9 rule 5).
create type season_type as enum ('seasonal', 'year_round');

create type content_source as enum ('ai', 'upload', 'spreadsheet');

-- The review gate sits after ads exist in Meta as PAUSED drafts, so a
-- variation that has been pushed is still awaiting judgment.
create type variation_status as enum (
  'draft', 'pushing', 'pushed', 'kept', 'rejecting', 'rejected', 'failed'
);

create type job_status as enum (
  'queued', 'running', 'succeeded', 'failed', 'cancelled'
);

create type job_kind as enum ('push', 'reject');

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id                        uuid primary key default gen_random_uuid(),

  -- Full display name, e.g. 'Carefree Boat Club - South Florida'.
  name                      text not null,
  -- Previously derived at render time by splitting `name` on a whitespace-
  -- padded hyphen/en-dash/em-dash, which silently failed on 'Brand-Location'.
  -- Stored explicitly; the splitter becomes an import-time suggestion only.
  brand                     text,
  location_label            text,

  industry                  industry not null default 'boat_club',
  marine_business_type      marine_business_type,
  season_type               season_type not null default 'seasonal',

  meta_ad_account_id        text,
  meta_page_id              text,
  meta_pixel_id             text,
  instagram_account_id      text,

  landing_page_url          text,
  location_description      text,
  current_promotion         text,

  -- boat_club prompt variables
  market_name               text,
  boating_style             text,
  environment_style         text,

  -- generic-industry prompt variables
  business_type_description text,
  offer_description         text,
  tone_keywords             text,

  archived                  boolean not null default false,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- A marina without a subtype gets the generic prompt, which is wrong.
  constraint marina_requires_subtype check (
    industry <> 'marina' or marine_business_type is not null
  ),
  -- Meta rejects a bare account id; the act_ prefix is required.
  constraint ad_account_prefixed check (
    meta_ad_account_id is null or meta_ad_account_id like 'act\_%'
  )
);

create index clients_industry_idx on public.clients (industry) where not archived;
create index clients_brand_idx on public.clients (brand) where not archived;

create trigger clients_updated_at before update on public.clients
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- brand settings — PER CLIENT (was one global row)
-- ---------------------------------------------------------------------------

create table public.client_brand_settings (
  client_id         uuid primary key references public.clients(id) on delete cascade,
  brand_website_url text,
  brand_voice       text,
  key_phrases       text,
  never_say         text,
  ad_examples       text,
  updated_at        timestamptz not null default now()
);

create trigger client_brand_settings_updated_at before update on public.client_brand_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Remembered launch destination — removes 4 clicks per launch
-- ---------------------------------------------------------------------------

create table public.client_launch_defaults (
  client_id             uuid primary key references public.clients(id) on delete cascade,
  meta_campaign_id      text,
  meta_adset_id         text,
  instagram_account_id  text,
  apply_template        boolean not null default true,
  default_batch_size    integer not null default 12
                        check (default_batch_size between 1 and 50),
  updated_at            timestamptz not null default now()
);

create trigger client_launch_defaults_updated_at before update on public.client_launch_defaults
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Prompt templates — versioned, so you can tell what produced what
-- ---------------------------------------------------------------------------

create table public.prompt_templates (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('copy', 'image')),
  industry             industry,
  marine_business_type marine_business_type,
  version              integer not null,
  label                text not null,
  body                 text not null,
  is_active            boolean not null default false,
  created_at           timestamptz not null default now()
);

-- One active template per (kind, industry, subtype). NULLS NOT DISTINCT so a
-- null subtype collides with itself; coalescing an enum to text is not
-- IMMUTABLE and cannot be indexed.
create unique index prompt_templates_active_idx
  on public.prompt_templates (kind, industry, marine_business_type)
  nulls not distinct
  where is_active;

create unique index prompt_templates_version_idx
  on public.prompt_templates (kind, industry, marine_business_type, version)
  nulls not distinct;

-- ---------------------------------------------------------------------------
-- creatives
-- ---------------------------------------------------------------------------

create table public.creatives (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,

  storage_path       text not null,
  image_url          text not null,
  label              text,

  source             content_source not null default 'upload',
  -- Provenance: which prompt produced this, and what it actually rendered to.
  prompt_template_id uuid references public.prompt_templates(id) on delete set null,
  rendered_prompt    text,
  scene              text,

  -- Meta image library hash. Persisted on EVERY path, including the Cloudinary
  -- path, which previously discarded it and re-uploaded on every push.
  meta_image_hash    text,

  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index creatives_client_idx on public.creatives (client_id) where not archived;
create index creatives_unsynced_idx on public.creatives (client_id)
  where meta_image_hash is null and not archived;

create trigger creatives_updated_at before update on public.creatives
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ad variations
-- ---------------------------------------------------------------------------

create table public.ad_variations (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  creative_id        uuid references public.creatives(id) on delete set null,

  headline           text not null,
  primary_text       text not null,
  angle              text,

  source             content_source not null default 'ai',
  prompt_template_id uuid references public.prompt_templates(id) on delete set null,
  rendered_prompt    text,

  status             variation_status not null default 'draft',

  meta_ad_id         text,
  meta_creative_id   text,
  meta_adset_id      text,
  error              text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index ad_variations_client_idx on public.ad_variations (client_id);
create index ad_variations_status_idx on public.ad_variations (client_id, status);

-- Idempotency: one live ad per variation per ad set. Re-running a launch
-- cannot duplicate ads in a client's account.
create unique index ad_variations_meta_unique_idx
  on public.ad_variations (id, meta_adset_id)
  where meta_ad_id is not null;

create trigger ad_variations_updated_at before update on public.ad_variations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Launch jobs — resumable, so a function timeout is an interruption
-- ---------------------------------------------------------------------------

create table public.jobs (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  kind             job_kind not null,
  status           job_status not null default 'queued',

  meta_campaign_id text,
  meta_adset_id    text,
  apply_template   boolean not null default true,

  total_items      integer not null default 0,
  completed_items  integer not null default 0,
  failed_items     integer not null default 0,

  error            text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index jobs_client_idx on public.jobs (client_id, created_at desc);
create index jobs_pending_idx on public.jobs (status) where status in ('queued', 'running');

create trigger jobs_updated_at before update on public.jobs
  for each row execute function set_updated_at();

create table public.job_items (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs(id) on delete cascade,
  variation_id  uuid not null references public.ad_variations(id) on delete cascade,
  status        job_status not null default 'queued',
  attempts      integer not null default 0,
  error         text,
  finished_at   timestamptz,
  created_at    timestamptz not null default now(),

  unique (job_id, variation_id)
);

create index job_items_pending_idx on public.job_items (job_id)
  where status in ('queued', 'running');

-- ---------------------------------------------------------------------------
-- Launch presets — "run the summer promo again" in one click
-- ---------------------------------------------------------------------------

create table public.launch_presets (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  name         text not null,
  batch_size   integer not null default 12 check (batch_size between 1 and 50),
  scenes       text[] not null default '{}',
  offer        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (client_id, name)
);

create index launch_presets_client_idx on public.launch_presets (client_id);

create trigger launch_presets_updated_at before update on public.launch_presets
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Non-secret app config. Credentials live in Vercel env vars and NEVER here.
-- The old app_settings table stored plaintext tokens and was readable through
-- an unauthenticated function (docs/SPEC.md §8).
-- ---------------------------------------------------------------------------

create table public.app_config (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

create trigger app_config_updated_at before update on public.app_config
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- Authorization is currently binary: signed in or not, matching the existing
-- single-operator model. Every policy is scoped to `authenticated` and anon is
-- granted nothing. When the tool becomes multi-user, add an owner column and
-- tighten these rather than adding a parallel system.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'clients', 'client_brand_settings', 'client_launch_defaults',
    'prompt_templates', 'creatives', 'ad_variations',
    'jobs', 'job_items', 'launch_presets', 'app_config'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;
end $$;

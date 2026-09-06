-- Covering indexes for two foreign keys the app actually filters on.
--
-- Late pairing counts ad_variations per creative_id to spread a batch across
-- the library, and every job slice reads job_items by variation_id. Both were
-- sequential scans; Supabase's performance advisor flagged them.
create index if not exists ad_variations_creative_id_idx
  on public.ad_variations (creative_id);

create index if not exists job_items_variation_id_idx
  on public.job_items (variation_id);

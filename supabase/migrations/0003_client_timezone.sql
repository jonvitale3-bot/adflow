-- The copy prompt's "today" and the ad names were computed on New York time
-- for every client, because nothing recorded where a client is. Filled from
-- the Meta ad account's timezone_name when blank, inferred from the location
-- for clients with no ad account yet, editable in the client form.
alter table public.clients add column if not exists timezone text;
comment on column public.clients.timezone is 'IANA zone, e.g. America/Los_Angeles. Filled from the Meta ad account when blank; the copy date and ad names are computed in it.';

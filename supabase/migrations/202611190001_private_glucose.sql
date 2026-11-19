-- Run once in the SQL Editor. No credentials go into this script.
begin;
create table public.orbit_glucose (
  user_id uuid not null references auth.users(id) on delete cascade,
  recorded_at timestamptz not null,
  value_mg_dl integer not null check (value_mg_dl between 20 and 600),
  trend text not null default 'None',
  source text not null default 'dexcom_share' check (source = 'dexcom_share'),
  primary key (user_id, recorded_at)
);
create table public.orbit_glucose_sync (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempted_at timestamptz not null,
  locked_until timestamptz not null,
  succeeded_at timestamptz,
  latest_at timestamptz,
  error_code text
);
-- Sensitive Share session IDs: no browser access, even for the owner.
create table public.orbit_share_session (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  credential_fingerprint text not null,
  updated_at timestamptz not null default now()
);
alter table public.orbit_glucose enable row level security;
alter table public.orbit_glucose_sync enable row level security;
alter table public.orbit_share_session enable row level security;
revoke all on public.orbit_glucose, public.orbit_glucose_sync, public.orbit_share_session
  from public, anon, authenticated;
grant select on public.orbit_glucose, public.orbit_glucose_sync to authenticated;
grant all on public.orbit_glucose, public.orbit_glucose_sync, public.orbit_share_session to service_role;
create policy glucose_read_own on public.orbit_glucose for select to authenticated
  using ((select auth.uid()) = user_id and recorded_at >= now() - interval '28 days');
create policy glucose_sync_read_own on public.orbit_glucose_sync for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.orbit_claim_glucose_sync(owner_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare claimed boolean := false;
begin
  insert into public.orbit_glucose_sync as s (user_id, attempted_at, locked_until)
  values(owner_id, now(), now() + interval '2 minutes')
  on conflict (user_id) do update set attempted_at=now(), locked_until=now()+interval '2 minutes'
  where s.locked_until < now() and s.attempted_at < now()-interval '1 minute'
  returning true into claimed;
  return coalesce(claimed,false);
end $$;
revoke all on function public.orbit_claim_glucose_sync(uuid) from public, anon, authenticated;
grant execute on function public.orbit_claim_glucose_sync(uuid) to service_role;

create function public.orbit_store_glucose(owner_id uuid, readings jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare total integer;
begin
  if jsonb_typeof(readings) <> 'array' or jsonb_array_length(readings) > 288 then
    raise exception 'Invalid reading batch';
  end if;
  insert into public.orbit_glucose(user_id,recorded_at,value_mg_dl,trend)
  select owner_id,r.recorded_at,r.value_mg_dl,r.trend
  from jsonb_to_recordset(readings) as r(recorded_at timestamptz,value_mg_dl integer,trend text)
  where r.recorded_at between now()-interval '28 days' and now()+interval '5 minutes'
  on conflict(user_id,recorded_at) do update set value_mg_dl=excluded.value_mg_dl,trend=excluded.trend;
  get diagnostics total = row_count;
  delete from public.orbit_glucose where user_id=owner_id and recorded_at<now()-interval '28 days';
  update public.orbit_glucose_sync set succeeded_at=now(),locked_until=now(),error_code=null,
    latest_at=(select max(recorded_at) from public.orbit_glucose where user_id=owner_id)
  where user_id=owner_id;
  return total;
end $$;
revoke all on function public.orbit_store_glucose(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.orbit_store_glucose(uuid,jsonb) to service_role;
commit;

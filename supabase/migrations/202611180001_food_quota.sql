-- Run once. Only request counts are stored here, never photos or food text.
begin;
create table public.orbit_ai_quota (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  last_call timestamptz not null
);
alter table public.orbit_ai_quota enable row level security;
revoke all on public.orbit_ai_quota from public, anon, authenticated;
create function public.orbit_claim_food_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  allowed boolean := false;
  today_utc date := (now() at time zone 'UTC')::date;
begin
  if owner_id is null then return false; end if;
  insert into public.orbit_ai_quota as q (user_id, day, calls, last_call)
    values (owner_id, today_utc, 1, now())
  on conflict (user_id) do update set
    day = today_utc,
    calls = case when q.day = today_utc then q.calls + 1 else 1 end,
    last_call = now()
  where (q.day <> today_utc or q.calls < 20)
    and q.last_call < now() - interval '10 seconds'
  returning true into allowed;
  return coalesce(allowed, false);
end $$;
revoke all on function public.orbit_claim_food_request() from public, anon;
grant execute on function public.orbit_claim_food_request() to authenticated;
commit;

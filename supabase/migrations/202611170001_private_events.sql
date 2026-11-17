-- Run once in Supabase SQL Editor. No Dexcom credentials or readings stored.
begin;
create table public.orbit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('activity', 'stress', 'other')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (occurred_at <= created_at + interval '5 minutes')
);
create index orbit_events_owner_time on public.orbit_events(user_id, occurred_at desc);
alter table public.orbit_events enable row level security;
alter table public.orbit_events force row level security;
revoke all on public.orbit_events from public, anon, authenticated;
grant select, insert, delete on public.orbit_events to authenticated;
create policy events_read_own on public.orbit_events for select to authenticated
  using ((select auth.uid()) = user_id);
create policy events_insert_own on public.orbit_events for insert to authenticated
  with check ((select auth.uid()) = user_id and occurred_at > now() - interval '28 days');
create policy events_delete_own on public.orbit_events for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Serialize per-owner inserts, prune expired rows and keep only the latest 20.
-- Security invoker: every mutation remains constrained by the user's RLS.
create function public.orbit_event_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  return new;
end $$;
create trigger orbit_event_lock before insert on public.orbit_events
for each row execute function public.orbit_event_lock();
create function public.orbit_event_trim() returns trigger
language plpgsql set search_path = '' as $$
begin
  delete from public.orbit_events where user_id = new.user_id
    and (occurred_at < now() - interval '28 days' or id in (
      select id from public.orbit_events where user_id = new.user_id
      order by occurred_at desc, created_at desc, id desc offset 20
    ));
  return new;
end $$;
create trigger orbit_event_trim after insert on public.orbit_events
for each row execute function public.orbit_event_trim();
revoke all on function public.orbit_event_lock() from public, anon, authenticated;
revoke all on function public.orbit_event_trim() from public, anon, authenticated;
commit;

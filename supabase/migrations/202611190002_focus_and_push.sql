-- Additive and rerunnable. Does not change glucose/events or existing jobs.
begin;
create table if not exists public.orbit_focus_plans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan jsonb not null check(jsonb_typeof(plan)='object' and octet_length(plan::text)<24000),
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '28 days'
);
create index if not exists orbit_focus_owner on public.orbit_focus_plans(user_id);
create unique index if not exists orbit_focus_one_active on public.orbit_focus_plans(user_id) where plan->>'status'='active';
alter table public.orbit_focus_plans enable row level security;
alter table public.orbit_focus_plans force row level security;
revoke all on public.orbit_focus_plans from public,anon,authenticated;
grant select on public.orbit_focus_plans to authenticated;
grant all on public.orbit_focus_plans to service_role;
drop policy if exists focus_read_own on public.orbit_focus_plans;
create policy focus_read_own on public.orbit_focus_plans for select to authenticated using(user_id=(select auth.uid()) and expires_at>now());

create table if not exists public.orbit_push_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(length(endpoint)<2048),
 subscription jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.orbit_push_devices enable row level security;
alter table public.orbit_push_devices force row level security;
revoke all on public.orbit_push_devices from public,anon,authenticated;
grant all on public.orbit_push_devices to service_role;
create table if not exists public.orbit_push_deliveries (
 id bigint generated always as identity primary key,
 plan_id uuid not null references public.orbit_focus_plans(id) on delete cascade,
 device_id uuid not null references public.orbit_push_devices(id) on delete cascade,
 day_key text not null,
 kind text not null check(kind in ('checkin','review','keep')),
 state text not null default 'claimed' check(state in ('claimed','accepted','failed')),
 created_at timestamptz not null default now(),
 unique(plan_id,device_id,day_key,kind)
);
alter table public.orbit_push_deliveries enable row level security;
alter table public.orbit_push_deliveries force row level security;
revoke all on public.orbit_push_deliveries from public,anon,authenticated;
grant all on public.orbit_push_deliveries to service_role;
grant usage,select on sequence public.orbit_push_deliveries_id_seq to service_role;

-- Compare-and-swap prevents one device overwriting another device's check-in.
create or replace function public.orbit_write_focus(p_owner uuid,p_id uuid,p_revision integer,p_plan jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,1));
 delete from public.orbit_focus_plans where user_id=p_owner and expires_at<=now();
 if p_revision=0 then
   if (select count(*) from public.orbit_focus_plans where user_id=p_owner)>=5 then raise exception 'Focus storage limit'; end if;
   insert into public.orbit_focus_plans(id,user_id,plan) values(p_id,p_owner,p_plan);
   return true;
 end if;
 update public.orbit_focus_plans set plan=p_plan,revision=revision+1
 where id=p_id and user_id=p_owner and revision=p_revision and expires_at>now();
 return found;
end $$;
revoke all on function public.orbit_write_focus(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.orbit_write_focus(uuid,uuid,integer,jsonb) to service_role;
-- Retention is independent of Web Push setup and does not touch existing jobs.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('orbit-focus-retention-hourly','23 * * * *',$job$
 delete from public.orbit_focus_plans where expires_at<=now();
 delete from public.orbit_push_devices where updated_at<now()-interval '28 days';
$job$);
commit;

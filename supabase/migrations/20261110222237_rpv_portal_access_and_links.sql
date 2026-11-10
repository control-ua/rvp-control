-- Shared object identity. Old rows intentionally stay unlinked.
alter table public.applications add column customer_site_id uuid references public.rpv_customer_sites(id);
create index applications_customer_site_id_idx on public.applications(customer_site_id) where customer_site_id is not null;

create table public.rpv_portal_events (
 id bigint generated always as identity primary key,
 actor text not null,
 action text not null,
 application_id uuid references public.applications(id) on delete set null,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.rpv_portal_events enable row level security;
revoke all on public.rpv_portal_events from public,anon,authenticated;
grant all on public.rpv_portal_events to service_role;
grant usage,select on sequence public.rpv_portal_events_id_seq to service_role;

-- Existing permissive policies stay intact. This additional restrictive gate
-- requires an active office identity for every direct Data API operation.
-- Service-role bot/portal requests continue to perform explicit server checks.
do $$
declare t text;
begin
 foreach t in array array['applications','contractors','acts','act_files','application_files','application_comments','automation_rules','notifications'] loop
   execute format('create policy rpv_require_active_office on public.%I as restrictive for all to anon, authenticated using (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid()) and au.is_active=true)) with check (exists (select 1 from public.admin_users au where au.user_id=(select auth.uid()) and au.is_active=true))',t);
 end loop;
end $$;

create function public.rpv_portal_contractor_transition(p_user bigint,p_application uuid,p_transition text,p_version timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare c uuid; a public.applications%rowtype;
begin
 select id into c from public.contractors where telegram_id=p_user and status='active' and phone is not null for share;
 if c is null then return false; end if;
 select * into a from public.applications where id=p_application and contractor_id=c for update;
 if not found or a.updated_at is distinct from p_version or a.status in ('completed','cancelled') then return false; end if;
 if p_transition='accept' and a.contractor_stage='offered' then
   update public.applications set contractor_stage='accepted',accepted_at=now(),updated_at=now() where id=a.id;
 elsif p_transition='depart' and a.contractor_stage='accepted' then
   update public.applications set contractor_stage='departed',departed_at=now(),updated_at=now() where id=a.id;
 elsif p_transition='decline' and a.contractor_stage='offered' then
   update public.applications set contractor_id=null,contractor_stage='declined',status='new',updated_at=now() where id=a.id;
 else return false;
 end if;
 insert into public.rpv_portal_events(actor,action,application_id,details) values(p_user::text,p_transition,a.id,jsonb_build_object('previous_stage',a.contractor_stage,'contractor_id',c));
 return true;
end $$;
revoke all on function public.rpv_portal_contractor_transition(bigint,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.rpv_portal_contractor_transition(bigint,uuid,text,timestamptz) to service_role;

create function public.rpv_portal_link_application(p_application uuid,p_site uuid,p_actor uuid,p_version timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare a public.applications%rowtype; published uuid;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor and is_active=true and role in ('owner','admin','dispatcher')) then return false; end if;
 perform id from public.rpv_customer_sites where id=p_site for share;
 if not found then return false; end if;
 select * into a from public.applications where id=p_application for update;
 if not found or a.updated_at is distinct from p_version then return false; end if;
 if a.customer_site_id is not null then return a.customer_site_id=p_site; end if;
 select site_id into published from public.rpv_customer_act_data where application_id=p_application;
 if published is not null and published<>p_site then return false; end if;
 update public.applications set customer_site_id=p_site,updated_at=now() where id=p_application;
 insert into public.rpv_portal_events(actor,action,application_id,details) values(p_actor::text,'link_site',p_application,jsonb_build_object('site_id',p_site));
 return true;
end $$;
revoke all on function public.rpv_portal_link_application(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.rpv_portal_link_application(uuid,uuid,uuid,timestamptz) to service_role;

-- These legacy privileged RPCs otherwise bypass table policies.
-- The bot uses its service role. The web app does not call these functions.
revoke execute on function public.claim_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_order(uuid,uuid) to service_role;
revoke execute on function public.delete_act_and_application(uuid) from public,anon,authenticated;
grant execute on function public.delete_act_and_application(uuid) to service_role;

-- One transaction per service action; API identity checks precede these service-only RPCs.
alter table public.applications add column arrived_at timestamptz;
alter table public.acts add column service_report jsonb;
create table public.rpv_service_reports(
 application_id uuid primary key references public.applications(id) on delete cascade,
 contractor_id uuid not null references public.contractors(id),
 work_date date not null,
 volume numeric check(volume>0 and volume<1000000 and volume=round(volume,3)),
 notes text not null default '' check(char_length(notes)<=2000),
 review_reason text not null default '',
 state text not null default 'draft' check(state in ('draft','submitted','approved','rejected')),
 updated_at timestamptz not null default now()
);
create index rpv_service_reports_contractor_idx on public.rpv_service_reports(contractor_id);
alter table public.rpv_service_reports enable row level security;
revoke all on public.rpv_service_reports from public,anon,authenticated;
grant all on public.rpv_service_reports to service_role;
grant select on public.rpv_service_reports to authenticated;
create policy rpv_service_reports_office_read on public.rpv_service_reports for select to authenticated using(exists(select 1 from public.admin_users au where au.user_id=(select auth.uid()) and au.is_active));

create function public.rpv_service_transition(p_user bigint,p_application uuid,p_action text,p_version timestamptz,p_note text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c uuid;a public.applications%rowtype;
begin
 select id into c from public.contractors where telegram_id=p_user and status='active' and nullif(phone,'') is not null for share;
 if c is null then raise exception 'Access denied' using errcode='42501';end if;
 select * into a from public.applications where id=p_application and contractor_id=c for update;
 if not found or a.updated_at is distinct from p_version or a.status in ('completed','cancelled') or a.awaiting_act then raise exception 'Stale or unavailable application' using errcode='40001';end if;
 if p_action='accept' and a.contractor_stage='offered' then
  update public.applications set status='assigned',contractor_stage='accepted',accepted_at=now(),updated_at=now() where id=a.id;
 elsif p_action='decline' and a.contractor_stage='offered' then
  if char_length(btrim(coalesce(p_note,'')))<3 then raise exception 'Reason required' using errcode='22023';end if;
  update public.applications set contractor_id=null,status='new',contractor_stage='declined',has_problem=true,problem_comment='Відмова підрядника: '||btrim(p_note),accepted_at=null,departed_at=null,arrived_at=null,updated_at=now() where id=a.id;
 elsif p_action='depart' and a.contractor_stage='accepted' then
  update public.applications set contractor_stage='departed',departed_at=now(),updated_at=now() where id=a.id;
 elsif p_action='arrive' and a.contractor_stage='departed' and a.arrived_at is null then
  update public.applications set status='in_progress',arrived_at=now(),updated_at=now() where id=a.id;
 elsif p_action='problem' and a.contractor_stage in ('accepted','departed','problem') then
  if char_length(btrim(coalesce(p_note,'')))<3 then raise exception 'Reason required' using errcode='22023';end if;
  update public.applications set has_problem=true,problem_comment=btrim(p_note),updated_at=now() where id=a.id;
 else raise exception 'Invalid transition' using errcode='22023';end if;
 insert into public.rpv_portal_events(actor,action,application_id,details) values(p_user::text,'service_'||p_action,a.id,jsonb_build_object('previous_stage',a.contractor_stage,'contractor_id',c,'note',left(coalesce(p_note,''),2000)));
 return jsonb_build_object('ok',true,'application_number',a.application_number);
end $$;

create function public.rpv_service_report(p_user bigint,p_application uuid,p_version timestamptz,p_date date,p_volume numeric,p_notes text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c uuid;a public.applications%rowtype;
begin
 if p_date is null or p_date<'2020-01-01' or p_date>(now() at time zone 'Europe/Kyiv')::date or (p_volume is not null and (p_volume<=0 or p_volume>=1000000 or p_volume<>round(p_volume,3))) or p_notes is null or char_length(p_notes)>2000 then raise exception 'Invalid report' using errcode='22023';end if;
 select id into c from public.contractors where telegram_id=p_user and status='active' and nullif(phone,'') is not null for share;
 if c is null then raise exception 'Access denied' using errcode='42501';end if;
 select * into a from public.applications where id=p_application and contractor_id=c for update;
 if not found or a.updated_at is distinct from p_version or a.status in ('completed','cancelled') or a.awaiting_act or a.arrived_at is null then raise exception 'Report unavailable' using errcode='40001';end if;
 if exists(select 1 from public.acts where application_id=a.id and status in ('pending','approved')) then raise exception 'Act already submitted' using errcode='40001';end if;
 insert into public.rpv_service_reports(application_id,contractor_id,work_date,volume,notes) values(a.id,c,p_date,p_volume,btrim(p_notes)) on conflict(application_id) do update set contractor_id=excluded.contractor_id,work_date=excluded.work_date,volume=excluded.volume,notes=excluded.notes,review_reason='',state='draft',updated_at=now();
 insert into public.rpv_portal_events(actor,action,application_id,details) values(p_user::text,'service_report',a.id,jsonb_build_object('work_date',p_date,'reported_volume',p_volume));
 return jsonb_build_object('ok',true);
end $$;

create function public.rpv_service_attach(p_user bigint,p_application uuid,p_key uuid,p_file text,p_type text,p_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c uuid;a public.applications%rowtype;r public.rpv_service_reports%rowtype;v_act public.acts%rowtype;v_created boolean:=false;
begin
 if p_key is null or nullif(p_file,'') is null or char_length(p_file)>1000 or p_type is null or p_type not in ('photo','document') or p_name is null or char_length(p_name)>180 then raise exception 'Invalid file' using errcode='22023';end if;
 select id into c from public.contractors where telegram_id=p_user and status='active' and nullif(phone,'') is not null for share;
 if c is null then raise exception 'Access denied' using errcode='42501';end if;
 select * into a from public.applications where id=p_application and contractor_id=c for update;
 if not found or a.status in ('completed','cancelled') then raise exception 'Application unavailable' using errcode='40001';end if;
 select * into r from public.rpv_service_reports where application_id=a.id and contractor_id=c and state in ('draft','submitted') for update;
 if not found then raise exception 'Report required' using errcode='22023';end if;
 select * into v_act from public.acts where application_id=a.id and contractor_id=c and status='pending' order by created_at limit 1 for update;
 if not found then
  if exists(select 1 from public.acts where id=p_key or application_id=a.id and status='approved') then raise exception 'Act key unavailable' using errcode='40001';end if;
  insert into public.acts(id,contractor_id,application_id,telegram_file_id,file_type,file_name,status,act_number,act_date,service_report) values(p_key,c,a.id,p_file,p_type,p_name,'pending','A-'||upper(substr(replace(p_key::text,'-',''),1,16)),r.work_date::timestamp at time zone 'Europe/Kyiv',to_jsonb(r)) returning * into v_act;
  v_created:=true;
 end if;
 if not exists(select 1 from public.act_files where act_id=v_act.id and telegram_file_id=p_file) then
  if (select count(*) from public.act_files where act_id=v_act.id)>=10 then raise exception 'Too many files' using errcode='22023';end if;
  insert into public.act_files(act_id,telegram_file_id,file_type,file_name) values(v_act.id,p_file,p_type,p_name);
 end if;
 update public.rpv_service_reports set state='submitted',updated_at=now() where application_id=a.id;
 update public.applications set status='in_progress',awaiting_act=true,updated_at=now() where id=a.id;
 if v_created then insert into public.rpv_portal_events(actor,action,application_id,details) values(p_user::text,'service_submit',a.id,jsonb_build_object('act_id',v_act.id));end if;
 return jsonb_build_object('ok',true,'act_id',v_act.id,'created',v_created);
end $$;

-- Called only by the authenticated office API / verified bot-admin handler.
create function public.rpv_service_review(p_actor text,p_act uuid,p_decision text,p_reason text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.applications%rowtype;v_act public.acts%rowtype;r public.rpv_service_reports%rowtype;s public.rpv_customer_sites%rowtype;v_app uuid;pub jsonb;tg bigint;
begin
 if nullif(p_actor,'') is null or p_decision is null or p_decision not in ('approved','rejected') then raise exception 'Invalid review' using errcode='22023';end if;
 select application_id into v_app from public.acts where id=p_act;
 select * into a from public.applications where id=v_app for update;
 if not found then raise exception 'Application missing' using errcode='22023';end if;
 select * into v_act from public.acts where id=p_act for update;
 if v_act.status=p_decision then return jsonb_build_object('ok',true,'changed',false);end if;
 if v_act.status<>'pending' or a.status='cancelled' or a.contractor_id is distinct from v_act.contractor_id then raise exception 'Act unavailable' using errcode='40001';end if;
 if v_act.service_report is not null then r:=jsonb_populate_record(null::public.rpv_service_reports,v_act.service_report);end if;
 select telegram_id into tg from public.contractors where id=a.contractor_id;
 if p_decision='approved' then
  if exists(select 1 from public.acts where application_id=a.id and status='approved' and id<>p_act) then raise exception 'Already approved' using errcode='40001';end if;
  update public.acts set status='approved',reviewed_at=now() where id=p_act;
  update public.applications set status='completed',contractor_stage='completed',awaiting_act=false,actual_volume=case when r.application_id is not null then r.volume else actual_volume end,updated_at=now() where id=a.id;
  if not exists(select 1 from public.work_history where application_id=a.id) then
   insert into public.work_history(application_id,contractor_id,title,description,completed_at) values(a.id,a.contractor_id,a.title,a.description,coalesce(r.work_date::timestamp at time zone 'Europe/Kyiv',now()));
  end if;
  if r.application_id is not null then
   if a.customer_site_id is not null then
    select * into s from public.rpv_customer_sites where id=a.customer_site_id;
    select to_jsonb(x) into pub from public.rpv_customer_publish(v_act.act_number,s.site_key,r.work_date,r.volume) x;
    if pub is null then raise exception 'Check object address and previous publication' using errcode='22023';end if;
   end if;
   update public.rpv_service_reports set state='approved',updated_at=now() where application_id=a.id;
  end if;
 else
  if char_length(btrim(coalesce(p_reason,'')))<3 or char_length(p_reason)>2000 then raise exception 'Rejection reason required' using errcode='22023';end if;
  update public.acts set status='rejected',reviewed_at=now() where id=p_act;
  update public.applications set status='in_progress',awaiting_act=false,updated_at=now() where id=a.id;
  update public.rpv_service_reports set state='rejected',review_reason=p_reason,updated_at=now() where application_id=a.id;
 end if;
 insert into public.rpv_portal_events(actor,action,application_id,details) values(p_actor,'service_'||p_decision,a.id,jsonb_build_object('act_id',p_act,'reason',p_reason,'publication',pub));
 return jsonb_build_object('ok',true,'changed',true,'application_id',a.id,'application_number',a.application_number,'contractor_telegram_id',tg,'publication',pub);
end $$;

-- Service APIs hold application row locks and retain the previous snapshot in the journal.
create function public.rpv_service_assign(p_actor uuid,p_application uuid,p_contractor uuid,p_version timestamptz)
returns boolean language plpgsql security invoker set search_path='' as $$
declare a public.applications%rowtype;
begin
 if not exists(select 1 from public.admin_users where user_id=p_actor and is_active and role in ('owner','admin','dispatcher')) then raise exception 'Access denied' using errcode='42501';end if;
 if not exists(select 1 from public.contractors where id=p_contractor and status='active' and nullif(phone,'') is not null) then raise exception 'Contractor unavailable' using errcode='22023';end if;
 select * into a from public.applications where id=p_application for update;
 if not found or a.updated_at is distinct from p_version or a.status in ('completed','cancelled') or a.arrived_at is not null or a.awaiting_act or exists(select 1 from public.acts where application_id=a.id and status in ('pending','approved')) then raise exception 'Cannot reassign' using errcode='40001';end if;
 update public.applications set contractor_id=p_contractor,status='assigned',contractor_stage='offered',accepted_at=null,departed_at=null,arrived_at=null,has_problem=false,problem_comment=null,updated_at=now() where id=a.id;
 insert into public.rpv_portal_events(actor,action,application_id,details) values(p_actor::text,'service_assign',a.id,jsonb_build_object('old_contractor',a.contractor_id,'contractor_id',p_contractor));
 return true;
end $$;

do $$ declare fn text;begin
 foreach fn in array array['rpv_service_transition(bigint,uuid,text,timestamptz,text)','rpv_service_report(bigint,uuid,timestamptz,date,numeric,text)','rpv_service_attach(bigint,uuid,uuid,text,text,text)','rpv_service_review(text,uuid,text,text)','rpv_service_assign(uuid,uuid,uuid,timestamptz)'] loop
  execute 'revoke all on function public.'||fn||' from public,anon,authenticated';
  execute 'grant execute on function public.'||fn||' to service_role';
 end loop;
end $$;

-- Direct web writes must respect office roles as well as UI visibility.
create function public.rpv_service_write_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r text;finance text[]:=array['payout_amount','unit_price','payout_status','paid_at','payout_receipt_file_id','payout_receipt_type','payout_receipt_name','paid_by','updated_at'];
begin
 if tg_table_name='acts' and tg_op='UPDATE' then
  if old.service_report is not null and new.service_report is distinct from old.service_report then raise exception 'Immutable submitted report' using errcode='42501';end if;
 end if;
 if current_user not in ('anon','authenticated') then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 select role into r from public.admin_users where user_id=(select auth.uid()) and is_active;
 if r is null or r='viewer' then raise exception 'Read-only office role' using errcode='42501';end if;
 if tg_table_name='applications' then
  if r='accountant' then
   if tg_op<>'UPDATE' then raise exception 'Finance updates only' using errcode='42501';end if;
   if (to_jsonb(new)-finance) is distinct from (to_jsonb(old)-finance) then raise exception 'Finance updates only' using errcode='42501';end if;
  elsif r='dispatcher' then
   if tg_op='DELETE' then raise exception 'Owner required for deletion' using errcode='42501';end if;
   if tg_op='UPDATE' and exists(select 1 from unnest(finance) key where key<>'updated_at' and to_jsonb(new)->key is distinct from to_jsonb(old)->key) then raise exception 'Finance role required' using errcode='42501';end if;
   if tg_op='INSERT' and (new.payout_amount<>0 or new.unit_price<>0 or new.payout_status<>'pending') then raise exception 'Finance role required' using errcode='42501';end if;
  elsif r not in ('owner','admin') then raise exception 'Unknown role' using errcode='42501';end if;
  if tg_op='UPDATE' and old.status='completed' and (new.status is distinct from old.status or new.contractor_id is distinct from old.contractor_id or new.actual_volume is distinct from old.actual_volume or new.customer_site_id is distinct from old.customer_site_id) then raise exception 'Accepted result requires a correction workflow' using errcode='42501';end if;
 elsif tg_table_name='acts' then
  if r not in ('owner','admin','dispatcher') then raise exception 'Dispatch role required' using errcode='42501';end if;
  if tg_op='UPDATE' and new.status is distinct from old.status then raise exception 'Use authenticated review API' using errcode='42501';end if;
 elsif tg_table_name='contractors' and r not in ('owner','admin','dispatcher') then raise exception 'Dispatch role required' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
revoke all on function public.rpv_service_write_guard() from public,anon,authenticated;
create trigger rpv_service_application_write before insert or update or delete on public.applications for each row execute function public.rpv_service_write_guard();
create trigger rpv_service_act_write before insert or update or delete on public.acts for each row execute function public.rpv_service_write_guard();
create trigger rpv_service_contractor_write before insert or update or delete on public.contractors for each row execute function public.rpv_service_write_guard();

-- Pending means review, not completed work. Metadata updates must retain that state.
create or replace function public.rvp_sync_application_act_state() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.application_id is null then return new;end if;
 if new.status='pending' then
  update public.applications set awaiting_act=true,updated_at=now() where id=new.application_id and awaiting_act is distinct from true;
 elsif new.status='rejected' then
  update public.applications set awaiting_act=false,status=case when status='completed' then 'in_progress' else status end,updated_at=now() where id=new.application_id;
 elsif new.status='approved' then
  update public.applications set awaiting_act=false,updated_at=now() where id=new.application_id and awaiting_act is distinct from false;
 end if;
 return new;
end $$;
revoke all on function public.rvp_sync_application_act_state() from public,anon,authenticated;

-- Calendar reads use the same current object grants as the customer cabinet.
-- No table grants, existing statuses, dates, or records are changed.
create or replace function public.rpv_customer_calendar(p_user bigint,p_month date,p_site uuid default null,p_query text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare v_today date := (now() at time zone 'Europe/Kyiv')::date; v_start timestamptz; v_end timestamptz; v_result jsonb;
begin
 if p_month is null or p_month<>date_trunc('month',p_month)::date or p_month<'2020-01-01'::date or p_month>(date_trunc('month',v_today)+interval '2 years')::date or p_offset is null or p_offset<0 or p_offset>100000 or p_query is null or char_length(p_query)>40 then
  raise exception 'Invalid calendar parameters' using errcode='22023';
 end if;
 if not exists(select 1 from public.customers where telegram_id=p_user and status='active' and nullif(phone,'') is not null) then
  raise exception 'Inactive customer' using errcode='42501';
 end if;
 if p_site is not null and not exists(select 1 from public.rpv_customer_visible_sites where telegram_id=p_user and id=p_site) then
  raise exception 'Site not accessible' using errcode='42501';
 end if;
 v_start:=p_month::timestamp at time zone 'Europe/Kyiv';
 v_end:=(p_month+interval '1 month')::timestamp at time zone 'Europe/Kyiv';
 with visible as (
  select distinct s.id,s.label,s.passport_network,s.passport_azk_code
  from public.rpv_customer_visible_sites s where s.telegram_id=p_user and (p_site is null or s.id=p_site)
   and (p_query='' or position(lower(btrim(p_query)) in lower(concat_ws(' ',s.passport_network,s.passport_azk_code,s.label)))>0)
 ), rows as (
  select a.id,a.application_number,a.title,a.description,a.address,a.status,a.contractor_stage,a.scheduled_at,a.deadline_at,a.actual_volume,a.updated_at,a.customer_site_id,a.awaiting_act,a.arrived_at,a.has_problem,a.problem_comment,
   s.label site_label,s.passport_network network,s.passport_azk_code site_code,
   coalesce(a.scheduled_at,a.deadline_at) visit_at,
   to_char(coalesce(a.scheduled_at,a.deadline_at) at time zone 'Europe/Kyiv','YYYY-MM-DD') calendar_day,
   case when a.scheduled_at is null then 'deadline' else 'scheduled' end date_kind,
   exists(select 1 from public.rpv_customer_act_data d join public.rpv_customer_visible_acts v on v.act_id=d.act_id where v.telegram_id=p_user and d.application_id=a.id) published
  from public.applications a join visible s on s.id=a.customer_site_id
 ), month_rows as (
  select * from rows where visit_at>=v_start and visit_at<v_end order by visit_at,id offset p_offset limit 201
 )
 select jsonb_build_object(
  'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.visit_at,e.id) from (select * from month_rows order by visit_at,id limit 200) e),'[]'::jsonb),
  'more',(select count(*)>200 from month_rows),
  'next',(select to_jsonb(n) from rows n where n.visit_at >= v_today::timestamp at time zone 'Europe/Kyiv'
    and n.status not in ('completed','done','cancelled','canceled','Виконана','Скасована') and not n.awaiting_act and not n.published
    order by n.visit_at,n.id limit 1),
  'month',to_char(p_month,'YYYY-MM'),'today',v_today
 ) into v_result;
 return v_result;
end $$;
revoke all on function public.rpv_customer_calendar(bigint,date,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.rpv_customer_calendar(bigint,date,uuid,text,integer) to service_role;

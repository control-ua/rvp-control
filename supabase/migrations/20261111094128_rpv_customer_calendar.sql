-- Calendar reads use the same current object grants as the customer cabinet.
-- No table grants, existing statuses, dates, or records are changed.
create function public.rpv_customer_calendar(p_user bigint,p_month date,p_site uuid default null,p_query text default '',p_offset integer default 0)
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
  select a.id,a.application_number,a.title,a.description,a.address,a.status,a.contractor_stage,a.scheduled_at,a.deadline_at,a.actual_volume,a.updated_at,a.customer_site_id,a.awaiting_act,
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

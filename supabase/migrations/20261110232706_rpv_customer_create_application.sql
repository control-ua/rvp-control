-- Server-only creation. No table grants or existing policies are changed.
create function public.rpv_customer_create_application(p_user bigint,p_site uuid,p_request uuid,p_work text,p_date date)
returns table(id uuid,application_number text,created boolean)
language plpgsql security invoker set search_path='' as $$
declare c public.customers%rowtype; s public.rpv_customer_sites%rowtype; a public.applications%rowtype; v_work text; v_today date;
begin
 v_work:=btrim(p_work);
 if p_user is null or p_site is null or p_request is null or p_date is null or v_work is null or char_length(v_work)<1 or char_length(v_work)>2000 then
   raise exception 'Invalid request' using errcode='22023';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rpv-create-request:'||p_request::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('rpv-create-user:'||p_user::text,0));
 select * into c from public.customers where telegram_id=p_user and status='active' and phone is not null for share;
 if not found then raise exception 'Inactive customer' using errcode='42501'; end if;
 perform telegram_id from public.rpv_customer_access where telegram_id=p_user for share;
 select base.* into s from public.rpv_customer_sites base
  where base.id=p_site and exists(select 1 from public.rpv_customer_visible_sites v where v.telegram_id=p_user and v.id=base.id) for share;
 if not found then raise exception 'Site not accessible' using errcode='42501'; end if;
 select * into a from public.applications where applications.id=p_request;
 if found then
   if a.customer_telegram_id is distinct from p_user or a.customer_site_id is distinct from p_site or a.description is distinct from v_work or (a.scheduled_at at time zone 'Europe/Kyiv')::date is distinct from p_date then
     raise exception 'Request key already used' using errcode='23505';
   end if;
   return query select a.id,a.application_number,false;
   return;
 end if;
 v_today:=(now() at time zone 'Europe/Kyiv')::date;
 if p_date<v_today or p_date>v_today+366 then raise exception 'Invalid date' using errcode='22023'; end if;
 if (select count(*) from public.applications where customer_telegram_id=p_user and request_source='customer_web' and created_at>now()-interval '1 minute')>=10 then
   raise exception 'Rate limited' using errcode='54000';
 end if;
 insert into public.applications(
  id,application_number,title,description,address,status,contractor_stage,scheduled_at,deadline_at,
  azk_code,order_date_text,request_source,customer_telegram_id,customer_name,customer_username,customer_raw_text,customer_site_id
 ) values (
  p_request,'G-'||upper(substr(replace(p_request::text,'-',''),1,12)),s.label,v_work,s.address,'new','unassigned',
  p_date::timestamp at time zone 'Europe/Kyiv',((p_date+1)::timestamp at time zone 'Europe/Kyiv')-interval '1 second',
  s.passport_azk_code,to_char(p_date,'DD.MM.YYYY'),'customer_web',p_user,nullif(btrim(concat_ws(' ',c.first_name,c.last_name)),''),c.username,
  concat_ws(E'\n','Заявка з кабінету замовника','Об’єкт: '||s.label,'Адреса: '||s.address,'Бажана дата: '||to_char(p_date,'DD.MM.YYYY'),'Роботи: '||v_work,'Контакт: '||btrim(concat_ws(' ',c.first_name,c.last_name))||' · '||c.phone),p_site
 ) returning * into a;
 insert into public.rpv_portal_events(actor,action,application_id,details) values(p_user::text,'customer_create',a.id,jsonb_build_object('site_id',p_site));
 return query select a.id,a.application_number,true;
end $$;
revoke all on function public.rpv_customer_create_application(bigint,uuid,uuid,text,date) from public,anon,authenticated;
grant execute on function public.rpv_customer_create_application(bigint,uuid,uuid,text,date) to service_role;

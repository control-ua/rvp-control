-- Preserve old passport URLs and all originals; canonical passports own their own history.
alter table public.rpv_customer_sites add column merged_into uuid references public.rpv_customer_sites(id);
alter table public.rpv_customer_sites add constraint rpv_sites_no_self_merge check (merged_into is distinct from id);
create index rpv_sites_merged_into_idx on public.rpv_customer_sites(merged_into) where merged_into is not null;

-- Merge existing exact network + region + station-code duplicates. Keep the row
-- with the most orders; use the most frequent address/capacity pair as passport data.
-- Preserve every original and association in the existing private event journal.
do $$
declare g record; canonical public.rpv_customer_sites%rowtype; preferred public.rpv_customer_sites%rowtype; duplicate public.rpv_customer_sites%rowtype;
begin
 lock table public.rpv_customer_sites in share row exclusive mode;
 for g in select upper(btrim(passport_network)) network,passport_city_code city,passport_azk_code code
   from public.rpv_customer_sites where merged_into is null and passport_network is not null
   and passport_city_code is not null and passport_azk_code is not null
   group by 1,2,3 having count(*)>1 loop
  select s.* into canonical from public.rpv_customer_sites s
   where s.merged_into is null and upper(btrim(s.passport_network))=g.network
   and s.passport_city_code=g.city and s.passport_azk_code=g.code
   order by (select count(*) from public.applications a where a.customer_site_id=s.id) desc,s.id limit 1;
  select s.* into preferred from public.rpv_customer_sites s
   where s.merged_into is null and upper(btrim(s.passport_network))=g.network
   and s.passport_city_code=g.city and s.passport_azk_code=g.code
   order by (select count(*) from public.rpv_customer_sites x where x.merged_into is null
     and upper(btrim(x.passport_network))=g.network and x.passport_city_code=g.city and x.passport_azk_code=g.code
     and x.address=s.address and x.capacity_m3 is not distinct from s.capacity_m3) desc,
     (s.id=canonical.id) desc,s.id limit 1;
  insert into public.rpv_portal_events(actor,action,details) values('office:deduplicate','merge_site_snapshot',
   jsonb_build_object('canonical_before',to_jsonb(canonical),'passport_source',to_jsonb(preferred)));
  for duplicate in select s.* from public.rpv_customer_sites s
   where s.id<>canonical.id and s.merged_into is null and upper(btrim(s.passport_network))=g.network
   and s.passport_city_code=g.city and s.passport_azk_code=g.code loop
   insert into public.rpv_portal_events(actor,action,details) values('office:deduplicate','merge_site',
    jsonb_build_object('canonical_id',canonical.id,'original',to_jsonb(duplicate),
     'applications',coalesce((select jsonb_agg(a.id) from public.applications a where a.customer_site_id=duplicate.id),'[]'::jsonb),
     'published_acts',coalesce((select jsonb_agg(d.act_id) from public.rpv_customer_act_data d where d.site_id=duplicate.id),'[]'::jsonb)));
   insert into public.rpv_customer_access(telegram_id,scope_kind,scope_key)
    select distinct a.telegram_id,'site',canonical.site_key from public.rpv_customer_access a
    where (a.scope_kind='site' and a.scope_key=duplicate.site_key)
       or (a.scope_kind='network' and a.scope_key=duplicate.network_key)
       or (a.scope_kind='region' and a.scope_key=duplicate.network_key||'/'||duplicate.region_key)
    on conflict do nothing;
   update public.applications set customer_site_id=canonical.id where customer_site_id=duplicate.id;
   update public.rpv_customer_act_data set site_id=canonical.id where site_id=duplicate.id;
   update public.rpv_customer_sites set merged_into=canonical.id where id=duplicate.id;
  end loop;
  update public.rpv_customer_sites set address=preferred.address,capacity_m3=preferred.capacity_m3,
   label=preferred.label,passport_network=g.network where id=canonical.id;
 end loop;
end $$;

create unique index rpv_sites_active_identity on public.rpv_customer_sites
 (upper(btrim(passport_network)),passport_city_code,passport_azk_code)
 where merged_into is null and passport_network is not null and passport_city_code is not null and passport_azk_code is not null;

create or replace view public.rpv_customer_visible_sites with (security_invoker=true) as
 select distinct a.telegram_id,s.id,s.site_key,s.network_key,s.region_key,s.label,s.address,s.capacity_m3,
 s.passport_network,s.passport_city_code,s.passport_azk_code
 from public.rpv_customer_access a
 join public.customers c on c.telegram_id=a.telegram_id and c.status='active'
 join public.rpv_customer_sites s on
 (a.scope_kind='site' and a.scope_key=s.site_key or a.scope_kind='network' and a.scope_key=s.network_key
  or a.scope_kind='region' and a.scope_key=s.network_key||'/'||s.region_key)
 where s.merged_into is null;
revoke all on public.rpv_customer_visible_sites from public,anon,authenticated;
grant select on public.rpv_customer_visible_sites to service_role;

-- Repeated registration reuses a passport only if this manager already has access.
-- A different manager cannot claim an existing object's history by entering its code.
create or replace function public.rpv_customer_save_passport_v2(p_user bigint,p_state text,p_capacity integer)
returns text language plpgsql security invoker set search_path='' as $$
declare prefix constant text := 'customer_passport_v2:'; draft jsonb; v_network text; v_city text; v_code text; v_address text;
 new_id uuid := pg_catalog.gen_random_uuid(); new_key text := 'self-'||new_id::text; existing public.rpv_customer_sites%rowtype;
begin
 if p_state is null or not starts_with(p_state,prefix) or p_capacity is null or p_capacity not in (10,15,20,25) then return null;end if;
 perform 1 from public.customers where telegram_id=p_user and status='active' and phone is not null for share;
 if not found then return null;end if;
 update public.bot_sessions set state='customer_cabinet',updated_at=now() where telegram_id=p_user and state=p_state;
 if not found then return null;end if;
 draft:=substring(p_state from char_length(prefix)+1)::jsonb;
 v_network:=upper(draft->>'network');v_city:=draft->>'city';v_code:=draft->>'azkCode';v_address:=draft->>'address';
 if v_network is null or v_network !~ '^[A-Za-z]{1,30}$' or v_city is null or v_city !~ '^UA[0-9]{17}$'
  or v_code is null or v_code !~ '^[0-9]{1,20}$' or v_address is null or char_length(btrim(v_address)) not between 1 and 350
 then raise exception 'Incomplete or invalid passport draft';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_network||'/'||v_city||'/'||v_code,0));
 select * into existing from public.rpv_customer_sites where merged_into is null
  and upper(btrim(passport_network))=v_network and passport_city_code=v_city and passport_azk_code=v_code for share;
 if found then
  if not exists(select 1 from public.rpv_customer_visible_sites where telegram_id=p_user and id=existing.id)
   then raise exception 'Object already registered; office access required' using errcode='23505';end if;
  return existing.site_key;
 end if;
 insert into public.rpv_customer_sites(id,site_key,network_key,region_key,label,address,capacity_m3,passport_network,passport_city_code,passport_azk_code)
 values(new_id,new_key,new_key,'self','АЗК '||v_network||' '||v_code,btrim(v_address),p_capacity,v_network,v_city,v_code);
 insert into public.rpv_customer_access(telegram_id,scope_kind,scope_key) values(p_user,'site',new_key);
 return new_key;
end $$;
revoke all on function public.rpv_customer_save_passport_v2(bigint,text,integer) from public,anon,authenticated;
grant execute on function public.rpv_customer_save_passport_v2(bigint,text,integer) to service_role;

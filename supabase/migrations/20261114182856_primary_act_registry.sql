-- A web primary act and a bot primary act share one registry and review workflow.
alter table public.act_files alter column telegram_file_id drop not null;
alter table public.act_files add column storage_path text;
alter table public.act_files add column application_file_id uuid unique
 references public.application_files(id) on delete set null;
alter table public.act_files add constraint act_files_source_check
 check(nullif(telegram_file_id,'') is not null or nullif(storage_path,'') is not null);
create index act_files_storage_path_idx on public.act_files(storage_path) where storage_path is not null;

create function public.rpv_register_primary_file(p_file uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare f public.application_files%rowtype; a public.applications%rowtype; v_act uuid;
begin
 select * into f from public.application_files where id=p_file;
 if not found or f.category<>'act' then return null; end if;
 select act_id into v_act from public.act_files where application_file_id=f.id;
 if found then return v_act; end if;
 select * into a from public.applications where id=f.application_id for update;
 if not found or a.status in ('completed','cancelled') then
  raise exception 'Application unavailable for a new act' using errcode='40001';
 end if;
 -- A path must belong to this application and refer to a real private object.
 if f.storage_path is not null then
  if f.storage_path not like a.id::text||'/%' or not exists(
   select 1 from storage.objects where bucket_id='application-media' and name=f.storage_path
  ) then raise exception 'Stored act file missing' using errcode='22023'; end if;
 elsif nullif(f.telegram_file_id,'') is null then
  raise exception 'Act file required' using errcode='22023';
 end if;
 -- The application lock serializes simultaneous uploads and contractor submissions.
 select id into v_act from public.acts where application_id=a.id and status='pending'
  and contractor_id is not distinct from a.contractor_id order by created_at desc limit 1 for update;
 if v_act is null then
  if exists(select 1 from public.acts where application_id=a.id and status='approved') then
   raise exception 'Accepted act is immutable' using errcode='40001';
  end if;
  v_act:=gen_random_uuid();
  insert into public.acts(id,application_id,contractor_id,telegram_file_id,file_type,file_name,
   status,act_number,created_at)
  values(v_act,a.id,a.contractor_id,f.telegram_file_id,
   case when f.file_type in ('image/jpeg','image/png','photo') then 'photo' else 'document' end,
   f.file_name,'pending','A-'||upper(substr(replace(v_act::text,'-',''),1,16)),f.created_at);
 end if;
 insert into public.act_files(act_id,telegram_file_id,storage_path,application_file_id,file_type,file_name,created_at)
 values(v_act,f.telegram_file_id,f.storage_path,f.id,
  case when f.file_type in ('image/jpeg','image/png','photo') then 'photo' else 'document' end,f.file_name,f.created_at)
 on conflict(application_file_id) do nothing;
 return v_act;
end $$;
revoke all on function public.rpv_register_primary_file(uuid) from public,anon,authenticated;
grant execute on function public.rpv_register_primary_file(uuid) to service_role;

create function public.rpv_primary_file_registered() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.category<>'act' then return new; end if;
 if current_setting('role',true) in ('anon','authenticated') and not exists(
  select 1 from public.admin_users where user_id=(select auth.uid()) and is_active
   and role in ('owner','admin','dispatcher')
 ) then raise exception 'Dispatch role required' using errcode='42501'; end if;
 perform public.rpv_register_primary_file(new.id);
 return new;
end $$;
revoke all on function public.rpv_primary_file_registered() from public,anon,authenticated;
create trigger rpv_primary_file_registered after insert on public.application_files
 for each row execute function public.rpv_primary_file_registered();

-- Keep private binary originals when a primary act is in the history.
create policy primary_act_storage_delete_guard on storage.objects as restrictive for delete to authenticated
 using(bucket_id<>'application-media' or not exists(select 1 from public.act_files f where f.storage_path=name));
create policy primary_act_storage_update_guard on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'application-media' or not exists(select 1 from public.act_files f where f.storage_path=name));

-- Repair uploaded primary acts without approving/closing work or changing payouts.
do $$ declare f record; begin
 for f in select af.id from public.application_files af join public.applications a on a.id=af.application_id
  where af.category='act' and a.status not in ('completed','cancelled')
   and not exists(select 1 from public.act_files x where x.application_file_id=af.id)
   and not exists(select 1 from public.acts x where x.application_id=a.id and x.status='approved')
  order by af.created_at
 loop perform public.rpv_register_primary_file(f.id); end loop;
end $$;

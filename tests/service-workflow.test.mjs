import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table admin_users(user_id uuid primary key,role text,is_active boolean);
create table contractors(id uuid primary key,telegram_id bigint,status text,phone text);
create table rpv_customer_sites(id uuid primary key,site_key text,address text);
create table applications(id uuid primary key,application_number text,contractor_id uuid,title text,description text,address text,status text default 'new',contractor_stage text default 'offered',accepted_at timestamptz,departed_at timestamptz,updated_at timestamptz default now(),awaiting_act boolean default false,has_problem boolean default false,problem_comment text,actual_volume numeric,customer_site_id uuid,payout_amount numeric default 0,unit_price numeric default 0,payout_status text default 'pending',paid_at timestamptz,payout_receipt_file_id text,payout_receipt_type text,payout_receipt_name text,paid_by bigint);
create table acts(id uuid primary key,application_id uuid,contractor_id uuid,telegram_file_id text,file_type text,file_name text,status text,act_number text,act_date timestamptz,created_at timestamptz default now(),reviewed_at timestamptz);
create table act_files(id uuid primary key default gen_random_uuid(),act_id uuid,telegram_file_id text,file_type text,file_name text,created_at timestamptz default now());
create table work_history(id uuid primary key default gen_random_uuid(),application_id uuid,contractor_id uuid,title text,description text,completed_at timestamptz);
create table rpv_customer_act_data(act_id uuid primary key,application_id uuid unique,site_id uuid,work_date date,pumped_m3 numeric);
create table rpv_portal_events(id bigint generated always as identity primary key,actor text,action text,application_id uuid,details jsonb);
create function rpv_customer_publish(p_act text,p_site text,p_date date,p_volume numeric) returns table(act_id uuid,site_id uuid,work_date date,pumped_m3 numeric,application_number text) language plpgsql set search_path='' as $$
declare v_act public.acts%rowtype;sid uuid;begin
 select * into v_act from public.acts where act_number=p_act and status='approved';
 select s.id into sid from public.rpv_customer_sites s join public.applications a on a.id=v_act.application_id where s.site_key=p_site and s.address=a.address;
 if sid is null then return;end if;
 insert into public.rpv_customer_act_data values(v_act.id,v_act.application_id,sid,p_date,p_volume) on conflict on constraint rpv_customer_act_data_pkey do nothing;
 return query select d.act_id,d.site_id,d.work_date,d.pumped_m3,a.application_number from public.rpv_customer_act_data d join public.applications a on a.id=d.application_id where d.act_id=v_act.id;end$$;
grant usage on schema public,auth to anon,authenticated,service_role;grant all on all tables in schema public to service_role;grant usage,select on all sequences in schema public to service_role;grant select,insert,update,delete on applications,acts,contractors to authenticated;grant select on admin_users to authenticated;`);
await db.exec(await fs.readFile(new URL('../supabase/migrations/20261111110824_rpv_service_workflow.sql',import.meta.url),'utf8'));
await db.exec('create trigger rpv_sync_application_act_state after insert or update on acts for each row execute function rvp_sync_application_act_state()');
const owner='10000000-0000-0000-0000-000000000001',dispatcher='10000000-0000-0000-0000-000000000002',accountant='10000000-0000-0000-0000-000000000003',viewer='10000000-0000-0000-0000-000000000004';
const c='20000000-0000-0000-0000-000000000001',c2='20000000-0000-0000-0000-000000000002',app='30000000-0000-0000-0000-000000000001',site='40000000-0000-0000-0000-000000000001',act='60000000-0000-0000-0000-000000000001';
await db.exec(`insert into admin_users values('${owner}','owner',true),('${dispatcher}','dispatcher',true),('${accountant}','accountant',true),('${viewer}','viewer',true);insert into contractors values('${c}',123,'active','+380111111111'),('${c2}',124,'active','+380222222222');insert into rpv_customer_sites values('${site}','wog-13','Address');insert into applications(id,application_number,title,address,customer_site_id) values('${app}','G-13','АЗК WOG 13','Address','${site}');`);
const today=(await db.query(`select (now() at time zone 'Europe/Kyiv')::date::text d`)).rows[0].d;
async function service(sql,params=[]){await db.exec('set role service_role');try{return (await db.query(sql,params)).rows;}finally{await db.exec('reset role');}}
async function version(){return (await db.query('select updated_at::text v from applications where id=$1',[app])).rows[0].v;}
async function action(name,user=123,note='',v){return service('select rpv_service_transition($1,$2,$3,$4,$5) r',[user,app,name,v||await version(),note]);}
async function report(volume=10,date=today){return service('select rpv_service_report($1,$2,$3,$4,$5,$6) r',[123,app,await version(),date,volume,'2 рейси']);}
async function attach(key=act,file='telegram-file-1',user=123){return (await service('select rpv_service_attach($1,$2,$3,$4,$5,$6) r',[user,app,key,file,'document','act.pdf']))[0].r;}
async function review(decision='approved',reason=''){return (await service('select rpv_service_review($1,$2,$3,$4) r',[owner,act,decision,reason]))[0].r;}
await assert.rejects(service('select rpv_service_assign($1,$2,$3,$4)',[viewer,app,c,await version()]),e=>e.code==='42501');
await service('select rpv_service_assign($1,$2,$3,$4)',[owner,app,c,await version()]);
await assert.rejects(action('depart'),e=>e.code==='22023');
await assert.rejects(action('accept',124),e=>e.code==='40001');
const stale=await version();await action('accept');await assert.rejects(action('accept',123,'',stale),e=>e.code==='40001');
await assert.rejects(report(),e=>e.code==='40001');
await action('depart');await action('arrive');await action('problem',123,'Немає доступу');
assert.equal((await db.query('select contractor_stage,has_problem from applications')).rows[0].contractor_stage,'departed');
await assert.rejects(report(-1),e=>e.code==='22023');await assert.rejects(report(1.1234),e=>e.code==='22023');
await report();const submitted=await attach();assert.equal(submitted.created,true);
await db.exec(`update acts set file_name='metadata.pdf' where id='${act}'`);assert.equal((await db.query('select awaiting_act from applications')).rows[0].awaiting_act,true);
const retried=await attach();assert.equal(retried.act_id,act);assert.equal((await db.query('select count(*)::int n from act_files')).rows[0].n,1);
await assert.rejects(attach(act,'foreign-file',124),e=>e.code==='40001');
await assert.rejects(action('problem',123,'Інша проблема'),e=>e.code==='40001');
await assert.rejects(service('select rpv_service_assign($1,$2,$3,$4)',[owner,app,c2,await version()]),e=>e.code==='40001');
assert.equal((await db.query('select actual_volume from applications')).rows[0].actual_volume,null);
await assert.rejects(db.exec(`update acts set service_report='{}'`),e=>e.code==='42501');
await db.exec(`update rpv_customer_sites set address='Changed'`);
await assert.rejects(review(),e=>e.code==='22023');
assert.equal((await db.query('select status from acts')).rows[0].status,'pending');assert.equal((await db.query('select count(*)::int n from work_history')).rows[0].n,0);
await db.exec(`update rpv_customer_sites set address='Address'`);
assert.equal((await review()).changed,true);assert.equal((await review()).changed,false);
assert.equal((await db.query('select count(*)::int n from work_history')).rows[0].n,1);
assert.equal((await db.query('select sum(pumped_m3) v from rpv_customer_act_data')).rows[0].v,'10');
assert.equal((await db.query('select payout_status from applications')).rows[0].payout_status,'pending');
await assert.rejects(review('rejected','Уточніть обсяг'),e=>e.code==='40001');
async function asOffice(uid,sql){await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${uid}',false)`);try{return await db.query(sql);}finally{await db.exec('reset role');}}
await assert.rejects(asOffice(viewer,`update applications set title='Changed'`),e=>e.code==='42501');
await assert.rejects(asOffice(dispatcher,`update applications set payout_amount=999`),e=>e.code==='42501');
await assert.rejects(asOffice(accountant,`update applications set title='Changed'`),e=>e.code==='42501');
await asOffice(accountant,`update applications set payout_amount=999`);
await assert.rejects(asOffice(owner,`update applications set actual_volume=77`),e=>e.code==='42501');
await assert.rejects(asOffice(owner,`update acts set status='pending'`),e=>e.code==='42501');
for(const role of ['anon','authenticated'])for(const fn of ['rpv_service_transition(bigint,uuid,text,timestamptz,text)','rpv_service_report(bigint,uuid,timestamptz,date,numeric,text)','rpv_service_attach(bigint,uuid,uuid,text,text,text)','rpv_service_review(text,uuid,text,text)','rpv_service_assign(uuid,uuid,uuid,timestamptz)'])assert.equal((await db.query(`select has_function_privilege('${role}','${fn}','execute') ok`)).rows[0].ok,false);
// A rejected result can be corrected and submitted with a new act; accepted history is immutable.
await db.exec(`update applications set status='in_progress',contractor_stage='departed';update acts set status='pending';delete from work_history;delete from rpv_customer_act_data;`);
await assert.rejects(review('rejected',''),e=>e.code==='22023');await review('rejected','Потрібно чітке фото');
assert.equal((await db.query('select awaiting_act from applications')).rows[0].awaiting_act,false);
await report(12);const corrected='60000000-0000-0000-0000-000000000002';await attach(corrected,'new-photo');
assert.equal((await db.query("select count(*)::int n from acts where status='pending'")).rows[0].n,1);
await db.exec("update contractors set status='rejected' where telegram_id=123");await assert.rejects(report(12),e=>e.code==='42501');
console.log('PASS: complete workflow, ownership, stale writes, state order, reports/files, atomic rollback, publication/history idempotency, rejection/correction, revocation and office role boundaries.');await db.close();

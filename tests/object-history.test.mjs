import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import * as auth from '../supabase/functions/rpv-portal/auth.ts';
import * as history from '../supabase/functions/rpv-portal/site_history.ts';
import { contactLinks } from '../src/portal/contact.ts';
const migration = new URL('../supabase/migrations/20261114192011_canonical_object_history.sql',import.meta.url);
const ids = Array.from({length:6},(_,i)=>`40000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);

test('merging keeps one passport, its orders/acts/history and access; repeat registration cannot create or claim duplicates',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table customers(telegram_id bigint primary key,status text,phone text);
 create table bot_sessions(telegram_id bigint primary key,state text,updated_at timestamptz default now());
 create table rpv_customer_sites(id uuid primary key,site_key text unique,network_key text,region_key text,label text,address text,capacity_m3 numeric,passport_network text,passport_city_code text,passport_azk_code text);
 create table rpv_customer_access(telegram_id bigint references customers(telegram_id),scope_kind text,scope_key text,primary key(telegram_id,scope_kind,scope_key));
 create table applications(id uuid primary key,customer_site_id uuid references rpv_customer_sites(id),status text,actual_volume numeric);
 create table acts(id uuid primary key,application_id uuid references applications(id),status text);
 create table act_files(act_id uuid references acts(id),storage_path text);
 create table work_history(application_id uuid references applications(id),completed_at timestamptz);
 create table rpv_customer_act_data(act_id uuid primary key references acts(id),site_id uuid references rpv_customer_sites(id));
 create table rpv_portal_events(id bigint generated always as identity primary key,actor text,action text,details jsonb);
 create view rpv_customer_visible_sites with(security_invoker=true) as select a.telegram_id,s.* from rpv_customer_access a join customers c on c.telegram_id=a.telegram_id and c.status='active' join rpv_customer_sites s on a.scope_kind='site' and a.scope_key=s.site_key;
 insert into customers values(123,'active','+380000000000'),(124,'active','+380000000001');
 grant select,insert,update on all tables in schema public to service_role;grant usage,select on all sequences in schema public to service_role;`);
 for(let i=0;i<ids.length;i++)await db.query('insert into rpv_customer_sites values($1,$2,$2,$3,$4,$5,$6,$7,$8,$9)',[ids[i],`self-${ids[i]}`,'self','АЗК',i===0?'Test work address':'Full street address',i===0?10:20,i===3?'UPG':'WOG',i===4?'UA80000000000093317':'UA12020010010037010',i===5?'91':'90']);
 for(let i=0;i<3;i++)await db.exec(`insert into applications values('30000000-0000-0000-0000-00000000000${i+1}','${ids[i===2?1:0]}','completed',10);insert into acts values('60000000-0000-0000-0000-00000000000${i+1}','30000000-0000-0000-0000-00000000000${i+1}','approved');insert into act_files values('60000000-0000-0000-0000-00000000000${i+1}','original-${i}.pdf');insert into work_history values('30000000-0000-0000-0000-00000000000${i+1}',now());`);
 await db.exec(`insert into rpv_customer_access values(123,'site','self-${ids[1]}');insert into rpv_customer_act_data values('60000000-0000-0000-0000-000000000003','${ids[1]}');`);
 // Match the live view's column order before replacement.
 await db.exec('drop view rpv_customer_visible_sites');
 await db.exec(`create view rpv_customer_visible_sites with(security_invoker=true) as select a.telegram_id,s.* from rpv_customer_access a join customers c on c.telegram_id=a.telegram_id and c.status='active' join rpv_customer_sites s on a.scope_kind='site' and a.scope_key=s.site_key`);
 await db.exec(await fs.readFile(migration,'utf8'));
 const sites=(await db.query('select * from rpv_customer_sites order by id')).rows;
 assert.equal(sites.filter(s=>s.merged_into===null).length,4);
 assert.equal(sites[0].address,'Full street address');assert.equal(sites[0].capacity_m3,'20');
 assert.equal(sites[1].merged_into,ids[0]);assert.equal(sites[2].merged_into,ids[0]);
 assert.deepEqual(sites.slice(3).map(s=>s.merged_into),[null,null,null]);
 assert.equal((await db.query('select count(*)::int n from applications where customer_site_id=$1 and status=$2',[ids[0],'completed'])).rows[0].n,3);
 assert.equal((await db.query('select site_id from rpv_customer_act_data')).rows[0].site_id,ids[0]);
 assert.equal((await db.query('select count(*)::int n from acts where status=$1',['approved'])).rows[0].n,3);
 assert.equal((await db.query('select count(*)::int n from act_files')).rows[0].n,3);
 assert.equal((await db.query('select count(*)::int n from work_history')).rows[0].n,3);
 assert.deepEqual((await db.query('select id from rpv_customer_visible_sites where telegram_id=123')).rows.map(r=>r.id),[ids[0]]);
 assert.equal((await db.query('select count(*)::int n from rpv_portal_events')).rows[0].n,3);
 const draft='customer_passport_v2:'+JSON.stringify({network:'wog',city:'UA12020010010037010',azkCode:'90',address:'Do not replace canonical'});
 const save=async(user)=>{await db.query('insert into bot_sessions(telegram_id,state) values($1,$2) on conflict(telegram_id) do update set state=excluded.state',[user,draft]);await db.exec('set role service_role');try{return await db.query('select rpv_customer_save_passport_v2($1,$2,10) site',[user,draft]);}finally{await db.exec('reset role');}};
 assert.equal((await save(123)).rows[0].site,`self-${ids[0]}`);
 assert.equal((await db.query('select count(*)::int n from rpv_customer_sites')).rows[0].n,6);
 await assert.rejects(save(124),e=>e.code==='23505');
 assert.equal((await db.query('select count(*)::int n from rpv_customer_visible_sites where telegram_id=124')).rows[0].n,0);
 assert.equal((await db.query('select state from bot_sessions where telegram_id=124')).rows[0].state,draft);
 await assert.rejects(db.query("insert into rpv_customer_sites(id,site_key,passport_network,passport_city_code,passport_azk_code) values(gen_random_uuid(),'duplicate','wOg','UA12020010010037010','90')"),e=>e.code==='23505');
 await db.exec("update customers set status='rejected' where telegram_id=123");
 assert.equal((await db.query('select count(*)::int n from rpv_customer_visible_sites where telegram_id=123')).rows[0].n,0);
 } finally {await db.close();}
});

test('office history and registered contacts resolve old URLs, isolate each passport, paginate, and deny outsiders',async()=>{
 let role='viewer', fail=false, contactFail=false, handler;
 const readTables=[];
 const sites=ids.slice(0,3).map((id,i)=>({id,site_key:`self-${id}`,merged_into:i===1?ids[0]:null,passport_network:'WOG',passport_azk_code:'90',passport_city_code:'city'}));
 const makeContact=(id,status='active')=>({telegram_id:id,scope_kind:'site',scope_key:sites[0].site_key,customers:{first_name:`Manager ${id}`,last_name:null,username:id===123?'registered_manager':null,phone:'+380000000000',status}});
 const grants=[makeContact(123),makeContact(124),makeContact(125,'rejected'),makeContact(126,'pending'),{...makeContact(127),scope_key:sites[2].site_key},{...makeContact(128),scope_kind:'network'}];
 const apps=Array.from({length:53},(_,i)=>({id:String(i).padStart(3,'0'),customer_site_id:i===52?ids[2]:ids[0],created_at:'2026-11-14',status:i===51?'cancelled':i===50?'in_progress':'completed',acts:[],work_history:[]}));
 const db={auth:{getUser:async jwt=>jwt==='office'?{data:{user:{id:'office'}}}:{data:{user:null}}},from(table){readTables.push(table);let rows=table==='admin_users'?[{user_id:'office',role,is_active:role!=='revoked'}]:table==='rpv_customer_sites'?[...sites]:table==='rpv_customer_access'?[...grants]:[...apps],start=0,end=Infinity,orders=[];
 const q={select(){return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},order(k,o={}){orders.push([k,o.ascending!==false]);return q},range(a,b){start=a;end=b;return q},maybeSingle:async()=>({data:rows[0]||null,error:null}),then(ok,bad){rows.sort((a,b)=>{for(const [k,asc] of orders){const v=String(a[k]).localeCompare(String(b[k]));if(v)return asc?v:-v}return 0});return Promise.resolve({data:rows.slice(start,end+1),count:rows.length,error:fail||(contactFail&&table==='rpv_customer_access')?{message:'failed'}:null}).then(ok,bad)}};return q;}};
 const source=await fs.readFile(new URL('../supabase/functions/rpv-portal/index.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','Deno',compiled)(name=>name.includes('supabase-js')?{createClient:()=>db}:name.includes('auth')?auth:name.includes('site_history')?history:name.includes('ukraine_cities')?{ukraineCities:[]}: {},{}, {env:{get:()=>''},serve:fn=>{handler=fn}});
 const request=(token='office',page=0,site=ids[1],action='office.site_history')=>handler(new Request('https://test.example',{method:'POST',headers:{Authorization:token?'Bearer '+token:'','Content-Type':'application/json'},body:JSON.stringify({action,site,page})}));
 assert.equal((await request('')).status,401);assert.equal((await request('outsider')).status,401);
 role='unknown';assert.equal((await request()).status,403);role='revoked';assert.equal((await request()).status,403);role='viewer';
 assert.equal(readTables.includes('rpv_customer_access'),false,'unauthorized requests must not read contacts');
 const first=await (await request()).json();assert.equal(first.site.id,ids[0]);assert.equal(first.total,52);assert.equal(first.applications.length,50);assert.equal(first.more,true);
 assert.deepEqual(first.site.contacts.map(c=>c.telegram_id),[123,124]);assert.equal(first.site.contacts[0].first_name,'Manager 123');assert.equal(first.site.contacts[0].phone,'+380000000000');assert.equal(first.site.contacts[0].username,'registered_manager');
 assert.equal(first.site.site_key,undefined);assert.equal(first.site.contacts[0].status,undefined);
 assert.deepEqual((await (await request('office',0,ids[0],'office.site')).json()).site.contacts,first.site.contacts);
 const next=await (await request('office',1)).json();assert.equal(next.applications.length,2);assert.equal(next.more,false);assert.deepEqual(next.applications.map(a=>a.status),['in_progress','cancelled']);
 const otherSite=await (await request('office',0,ids[2])).json();assert.equal(otherSite.total,1);assert.deepEqual(otherSite.site.contacts.map(c=>c.telegram_id),[127]);
 grants.splice(grants.findIndex(g=>g.telegram_id===127),1);
 assert.deepEqual((await (await request('office',0,ids[2])).json()).site.contacts,[]);
 assert.equal((await request('office',0,ids[5])).status,404);assert.equal((await request('office',-1)).status,400);
 contactFail=true;assert.equal((await request()).status,500);contactFail=false;
 fail=true;assert.equal((await request()).status,500);
});

test('contact links use registered username or phone and reject malformed targets',()=>{
 assert.deepEqual(contactLinks({username:'@registered_manager',phone:'+380 (00) 000-00-00'}),{username:'registered_manager',phone:'+380000000000',telegram:'https://t.me/registered_manager'});
 assert.equal(contactLinks({username:null,phone:'+380000000000'}).telegram,'https://t.me/+380000000000');
 assert.deepEqual(contactLinks({username:'javascript:alert(1)',phone:'javascript:123456789'}),{username:null,phone:null,telegram:null});
 assert.equal(contactLinks({username:'name?text=oops',phone:null}).telegram,null);
 assert.equal(contactLinks({username:null,phone:null}).telegram,null);
});

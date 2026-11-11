import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { monthDays, shiftMonth, visitStatus } from '../src/portal/calendar.ts';
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create table customers(telegram_id bigint primary key,status text,phone text);
create table rpv_customer_sites(id uuid primary key,label text,passport_network text,passport_azk_code text);
create table rpv_customer_access(telegram_id bigint,site_id uuid);
create view rpv_customer_visible_sites as select a.telegram_id,s.* from rpv_customer_access a join rpv_customer_sites s on s.id=a.site_id;
create table applications(id uuid primary key,application_number text,title text,description text,address text,status text,contractor_stage text,scheduled_at timestamptz,deadline_at timestamptz,actual_volume numeric,updated_at timestamptz,customer_site_id uuid,awaiting_act boolean default false);
create table rpv_customer_act_data(act_id uuid,application_id uuid);
create table rpv_customer_visible_acts(telegram_id bigint,act_id uuid);
grant select on all tables in schema public to service_role;`);
await db.exec(await fs.readFile(new URL('../supabase/migrations/20261111094128_rpv_customer_calendar.sql',import.meta.url),'utf8'));
const s='40000000-0000-0000-0000-000000000001',foreign='40000000-0000-0000-0000-000000000002';
await db.exec(`insert into customers values(123,'active','+380111111111'),(124,'active','+380222222222'),(125,'pending','+380333333333');
insert into rpv_customer_sites values('${s}','WOG 0013','WOG','0013'),('${foreign}','UPG 0013','UPG','0013');
insert into rpv_customer_access values(123,'${s}'),(123,'${s}'),(124,'${foreign}');`);
async function add(id,date,opts={}) {
 const uuid=`30000000-0000-0000-0000-${String(id).padStart(12,'0')}`;
 await db.query(`insert into applications(id,application_number,title,description,address,status,contractor_stage,scheduled_at,deadline_at,updated_at,customer_site_id,awaiting_act)
 values($1,$2,'AZK','Pump','Address',$3,$4,$5,$6,now(),$7,$8)`,[uuid,`G-${id}`,opts.status||'new',opts.stage||'unassigned',opts.deadlineOnly?null:date,opts.deadlineOnly?date:null,opts.foreign?foreign:s,opts.awaiting||false]);
 return uuid;
}
await add(1,'2024-03-31T20:59:59Z'); // March 31 23:59:59 in Kyiv, after DST.
await add(2,'2024-03-31T21:00:00Z'); // April 1 00:00:00 in Kyiv.
await add(3,'2024-03-01T00:00:00Z',{foreign:true});
await add(4,'2024-03-10T08:00:00Z',{deadlineOnly:true});
await add(5,'2024-03-10T09:00:00Z',{status:'completed'});
await db.exec(`insert into rpv_customer_act_data values('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005');insert into rpv_customer_visible_acts values(123,'60000000-0000-0000-0000-000000000001');`);
async function calendar(user=123,month='2024-03-01',site=null,query='',offset=0){
 return (await db.query('select rpv_customer_calendar($1,$2,$3,$4,$5) value',[user,month,site,query,offset])).rows[0].value;
}
const march=await calendar();
assert.equal(march.events.length,3); // Duplicate object grant must not duplicate events.
assert.equal(march.events.find(e=>e.application_number==='G-1').calendar_day,'2024-03-31');
assert.equal(march.events.find(e=>e.application_number==='G-4').date_kind,'deadline');
assert.equal(march.events.find(e=>e.application_number==='G-5').published,true);
assert.equal((await calendar(123,'2024-04-01')).events[0].application_number,'G-2');
assert.equal((await calendar(123,'2024-03-01',null,'UPG')).events.length,0);
assert.equal((await calendar(123,'2024-03-01',null,'0013')).events.length,3);
assert.equal((await calendar(124)).events.length,1);
await assert.rejects(calendar(123,'2024-03-01',foreign),e=>e.code==='42501');
await assert.rejects(calendar(125),e=>e.code==='42501');
await assert.rejects(calendar(123,'2024-03-10'),e=>e.code==='22023');
await assert.rejects(calendar(123,'2099-01-01'),e=>e.code==='22023');
await assert.rejects(calendar(123,'2024-03-01',null,'',-1),e=>e.code==='22023');
const day=(await db.query(`select (now() at time zone 'Europe/Kyiv')::date::text d`)).rows[0].d;
await add(10,`${day}T00:00:00Z`,{status:'cancelled'});
await add(11,`${day}T01:00:00Z`,{status:'completed'});
await add(12,`${day}T02:00:00Z`,{awaiting:true});
await add(13,`${day}T03:00:00Z`,{stage:'accepted',status:'assigned'});
const next=await calendar();
assert.equal(next.next.application_number,'G-13'); // Nearest visit independent of displayed month.
await db.exec(`insert into applications(id,application_number,status,contractor_stage,scheduled_at,customer_site_id) select md5(i::text)::uuid,'B-'||i,'new','unassigned','2024-02-10T00:00:00Z','${s}' from generate_series(1,201) i;`);
const first=await calendar(123,'2024-02-01'),second=await calendar(123,'2024-02-01',null,'',200);
assert.equal(first.events.length,200);assert.equal(first.more,true);assert.equal(second.events.length,1);assert.equal(second.more,false);
assert.ok(!first.events.some(e=>e.id===second.events[0].id));
await db.exec(`update customers set status='rejected' where telegram_id=123`);
await assert.rejects(calendar(),e=>e.code==='42501');
for(const role of ['anon','authenticated'])assert.equal((await db.query(`select has_function_privilege('${role}','rpv_customer_calendar(bigint,date,uuid,text,integer)','execute') ok`)).rows[0].ok,false);
assert.equal(monthDays('2024-02').filter(Boolean).length,29);assert.equal(monthDays('2026-11')[0],null);assert.equal(monthDays('2026-06')[0],'2026-06-01');
assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2027-01',-1),'2026-12');
const visit={status:'new',contractor_stage:'unassigned',calendar_day:day,published:false,awaiting_act:false};
assert.equal(visitStatus(visit,day).tone,'planned');
assert.equal(visitStatus({...visit,status:'completed'},day).tone,'review');
assert.equal(visitStatus({...visit,published:true},day).tone,'done');
assert.equal(visitStatus({...visit,published:true,status:'cancelled'},day).tone,'muted');
assert.equal(visitStatus({...visit,calendar_day:'2020-01-01'},day).tone,'attention');
assert.equal(visitStatus({...visit,awaiting_act:true,calendar_day:'2020-01-01'},day).tone,'review');
console.log('PASS: calendar access, revocation, duplicate grants, Kyiv DST/month boundaries, future calendar, filtering, independent next visit, cancellation, published status and pagination.');
await db.close();

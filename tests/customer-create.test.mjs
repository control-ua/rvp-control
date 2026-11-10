import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create table customers(telegram_id bigint primary key,status text,phone text,first_name text,last_name text,username text);
create table rpv_customer_sites(id uuid primary key,label text,address text,passport_azk_code text);
create table rpv_customer_access(telegram_id bigint,site_id uuid);
create view rpv_customer_visible_sites as select a.telegram_id,s.* from rpv_customer_access a join rpv_customer_sites s on s.id=a.site_id;
create table applications(id uuid primary key,application_number text unique,title text,description text,address text,status text,contractor_stage text,scheduled_at timestamptz,deadline_at timestamptz,azk_code text,order_date_text text,request_source text,customer_telegram_id bigint,customer_name text,customer_username text,customer_raw_text text,customer_site_id uuid,created_at timestamptz default now());
create table rpv_portal_events(actor text,action text,application_id uuid,details jsonb);
`);
await db.exec(
  await fs.readFile(
    new URL(
      "../supabase/migrations/20261110232706_rpv_customer_create_application.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const s = "40000000-0000-0000-0000-000000000001",
  foreign = "40000000-0000-0000-0000-000000000002",
  request = "30000000-0000-0000-0000-000000000001";
await db.exec(
  `insert into customers values(123,'active','+380111111111','Test','Customer','testuser'),(124,'active','+380222222222','Other','Customer',null);insert into rpv_customer_sites values('${s}','АЗК WOG 0013','Address 13','0013'),('${foreign}','АЗК UPG 0013','Other address','0013');insert into rpv_customer_access values(123,'${s}'),(124,'${foreign}');`,
);
const today = (
  await db.query(`select (now() at time zone 'Europe/Kyiv')::date::text d`)
).rows[0].d;
async function create(
  user,
  site = s,
  id = request,
  work = "Відкачка РПВ",
  date = today,
) {
  return (
    await db.query(
      "select * from rpv_customer_create_application($1,$2,$3,$4,$5)",
      [user, site, id, work, date],
    )
  ).rows[0];
}
assert.equal((await create(123)).created, true);
assert.equal((await create(123)).created, false);
assert.equal(
  (await db.query("select count(*)::int n from applications")).rows[0].n,
  1,
);
const app = (await db.query("select * from applications")).rows[0];
assert.equal(app.customer_site_id, s);
assert.equal(app.azk_code, "0013");
assert.equal(app.address, "Address 13");
assert.equal(app.contractor_stage, "unassigned");
assert.equal(app.customer_telegram_id, 123);
assert.ok(app.customer_raw_text.includes("+380111111111"));
await assert.rejects(
  create(124, s, "30000000-0000-0000-0000-000000000002"),
  (e) => e.code === "42501",
);
await assert.rejects(
  create(123, foreign, "30000000-0000-0000-0000-000000000003"),
  (e) => e.code === "42501",
);
await assert.rejects(
  create(123, s, request, "Changed work"),
  (e) => e.code === "23505",
);
await assert.rejects(
  create(123, s, "30000000-0000-0000-0000-000000000004", "", today),
  (e) => e.code === "22023",
);
await assert.rejects(
  create(123, s, "30000000-0000-0000-0000-000000000005", "Work", "2020-01-01"),
  (e) => e.code === "22023",
);
await db.exec("delete from rpv_customer_access where telegram_id=123");
await assert.rejects(create(123), (e) => e.code === "42501");
await db.exec(
  `insert into rpv_customer_access values(123,'${s}');update customers set status='pending' where telegram_id=123;`,
);
await assert.rejects(create(123), (e) => e.code === "42501");
assert.equal(
  (
    await db.query(
      `select has_function_privilege('anon','rpv_customer_create_application(bigint,uuid,uuid,text,date)','EXECUTE') ok`,
    )
  ).rows[0].ok,
  false,
);
assert.equal(
  (await db.query("select count(*)::int n from rpv_portal_events")).rows[0].n,
  1,
);
console.log(
  "PASS: creation, ownership, duplicate retries, changed payload, dates, revoked access, inactive contacts, code preservation, audit and server-only privileges.",
);
await db.close();

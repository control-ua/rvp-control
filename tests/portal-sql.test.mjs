import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated;
create table public.admin_users(user_id uuid primary key,role text,is_active boolean);alter table admin_users enable row level security;create policy admin_read on admin_users for select to authenticated using(true);grant select on admin_users to authenticated,anon;
create table rpv_customer_sites(id uuid primary key);
create table contractors(id uuid primary key,telegram_id bigint,status text,phone text);alter table contractors enable row level security;create policy old_open on contractors for all to anon,authenticated using(true) with check(true);
create table applications(id uuid primary key,contractor_id uuid,status text,contractor_stage text,accepted_at timestamptz,departed_at timestamptz,updated_at timestamptz);alter table applications enable row level security;create policy old_open on applications for all to anon,authenticated using(true) with check(true);
create table rpv_customer_act_data(application_id uuid,site_id uuid);
create function claim_order(uuid,uuid) returns boolean language sql as $$select true$$;
create function delete_act_and_application(uuid) returns void language sql as $$select$$;
`);
for (const t of [
  "acts",
  "act_files",
  "application_files",
  "application_comments",
  "automation_rules",
  "notifications",
])
  await db.exec(
    `create table ${t}(id uuid primary key);alter table ${t} enable row level security;create policy old_open on ${t} for all to anon,authenticated using(true) with check(true);`,
  );
await db.exec(
  "grant select,insert,update,delete on all tables in schema public to anon,authenticated,service_role;",
);
await db.exec(
  await fs.readFile(
    new URL(
      "../supabase/migrations/20261110222237_rpv_portal_access_and_links.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const admin = "10000000-0000-0000-0000-000000000001",
  c = "20000000-0000-0000-0000-000000000001",
  c2 = "20000000-0000-0000-0000-000000000002",
  a = "30000000-0000-0000-0000-000000000001",
  s = "40000000-0000-0000-0000-000000000001";
await db.exec(
  `insert into admin_users values('${admin}','owner',true);insert into contractors values('${c}',123,'active','+380111111111'),('${c2}',124,'active','+380222222222');insert into rpv_customer_sites values('${s}');insert into applications(id,contractor_id,status,contractor_stage,updated_at) values('${a}','${c}','assigned','offered','2026-11-10T00:00:00Z');`,
);
async function under(role, uid, sql) {
  await db.exec(
    `set role ${role};select set_config('request.jwt.claim.sub','${uid}',false);`,
  );
  try {
    return (await db.query(sql)).rows;
  } finally {
    await db.exec("reset role;");
  }
}
assert.equal((await under("anon", "", `select * from applications`)).length, 0);
assert.equal(
  (
    await under(
      "authenticated",
      "50000000-0000-0000-0000-000000000001",
      `select * from applications`,
    )
  ).length,
  0,
);
assert.equal(
  (await under("authenticated", admin, `select * from applications`)).length,
  1,
);
assert.equal(
  (
    await under(
      "anon",
      "",
      `update applications set status='completed' returning id`,
    )
  ).length,
  0,
);
assert.equal(
  (await under("service_role", "", `select * from applications`)).length,
  1,
);
async function transition(user, action, version) {
  return (
    await under(
      "service_role",
      "",
      `select rpv_portal_contractor_transition(${user},'${a}','${action}','${version}') ok`,
    )
  )[0].ok;
}
assert.equal(await transition(124, "accept", "2026-11-10T00:00:00Z"), false);
assert.equal(await transition(123, "depart", "2026-11-10T00:00:00Z"), false);
assert.equal(await transition(123, "accept", "2026-11-10T00:00:00Z"), true);
assert.equal(await transition(123, "accept", "2026-11-10T00:00:00Z"), false);
const row = (
  await db.query(`select updated_at::text v from applications where id='${a}'`)
).rows[0];
assert.equal(await transition(123, "depart", row.v), true);
await db.exec(`update contractors set status='rejected' where id='${c}'`);
const changed = (
  await db.query(`select updated_at::text v from applications where id='${a}'`)
).rows[0];
assert.equal(await transition(123, "accept", changed.v), false);
assert.equal(
  (
    await under(
      "service_role",
      "",
      `select rpv_portal_link_application('${a}','${s}','${admin}','${changed.v}') ok`,
    )
  )[0].ok,
  true,
);
assert.equal(
  (await db.query(`select count(*)::int n from rpv_portal_events`)).rows[0].n,
  3,
);
for (const fn of [
  "rpv_portal_contractor_transition(bigint,uuid,text,timestamptz)",
  "rpv_portal_link_application(uuid,uuid,uuid,timestamptz)",
  "delete_act_and_application(uuid)",
  "claim_order(uuid,uuid)",
])
  assert.equal(
    (
      await db.query(
        `select has_function_privilege('anon','${fn}','execute') ok`,
      )
    ).rows[0].ok,
    false,
  );
console.log(
  "PASS: anonymous and non-office access denied; office/bot access preserved; ownership, stale versions, state order, revocation, linkage and audit verified.",
);
await db.close();

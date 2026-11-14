// Development-only synthetic browser scenario. Not imported by the production entry.
import React from "react";
import { createRoot } from "react-dom/client";
const sid = "40000000-0000-0000-0000-000000000001";
const site = {
  id: sid,
  label: "АЗК WOG 0013",
  passport_network: "WOG",
  code: "0013",
  region: "Дніпро · Дніпропетровська область",
  address: "м. Дніпро, вул. Прикладна, 13",
  capacity_m3: 20,
};
const other = {
  ...site,
  id: "40000000-0000-0000-0000-000000000002",
  label: "АЗК UPG 0013",
  passport_network: "UPG",
  address: "м. Київ, вул. Тестова, 7",
};
const date = (hours = 0) =>
  new Date(Date.now() + hours * 3600000).toISOString();
const apps = Array.from({ length: 7 }, (_, i) => ({
  id: `30000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  application_number: `G-${String(221 + i).padStart(4, "0")}`,
  title: i % 2 ? other.label : site.label,
  address: i % 2 ? other.address : site.address,
  azk_code: "0013",
  description:
    i === 0
      ? "Відкачка РПВ. Виконавець повідомив про перекритий під’їзд."
      : "Планове обслуговування септика. Відкачка РПВ.",
  contractor_id: i === 1 ? null : "c1",
  contractor:
    i === 1
      ? null
      : {
          id: "c1",
          first_name: "Тестовий",
          last_name: "Виконавець",
          phone: "+380000000000",
        },
  status: i === 6 ? "completed" : i === 1 ? "new" : "in_progress",
  customer_site_id: i % 2 ? other.id : sid,
  contractor_stage:
    i === 0
      ? "problem"
      : i === 1
        ? "unassigned"
        : i === 4
          ? "offered"
          : "departed",
  has_problem: i === 0,
  problem_comment: i === 0 ? "Перекритий під’їзд" : null,
  awaiting_act: i === 3,
  deadline_at: date(i === 0 ? -3 : i === 2 ? -1 : 8),
  scheduled_at: date(),
  created_at: date(-24),
  updated_at: date(),
  actual_volume: i === 6 ? 10 : null,
  payout_amount: i === 6 ? 4200 : 0,
  unit_price: 420,
  payout_status: "pending",
}));
const acts = [
  {
    id: "60000000-0000-0000-0000-000000000001",
    act_number: "A-0224",
    application_id: apps[3].id,
    status: "pending",
    created_at: date(),
    contractor_id: "c1",
    contractor: apps[0].contractor,
    application: apps[3],
    act_files: [],
  },
];
const customer = {
  telegram_id: 123,
  first_name: "Тестовий",
  last_name: "Менеджер",
  phone: "+380000000000",
  status: "active",
  username: null,
  updated_at: date(),
};
const json = (v: unknown) =>
  new Response(JSON.stringify(v), {
    headers: { "Content-Type": "application/json" },
  });
const realFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input
        : input.url,
    location.href,
  );
  if (url.pathname.endsWith("/rpv-portal")) {
    const b = JSON.parse(String(init?.body));
    if (b.action === "office.networks")
      return json({ networks: ["UPG", "WOG"] });
    if (b.action === "office.site")
      return json({ site: b.site === sid ? site : other });
    if (b.action === "office.sites")
      return json({
        sites: [site, other].filter(
          (s) => !b.network || s.passport_network === b.network,
        ),
        more: false,
      });
    if (b.action === "office.list")
      return json({
        customers: b.status === "active" ? [customer] : [],
        more: false,
        canManage: true,
      });
    if (b.action === "office.applications")
      return json({ applications: apps, more: false });
    return json({});
  }
  if (url.pathname.includes("/rest/v1/")) {
    const table = url.pathname.split("/").pop(),
      select = url.searchParams.get("select") || "";
    let rows: any[] =
      table === "applications"
        ? [...apps]
        : table === "acts"
          ? [...acts]
          : table === "contractors"
            ? [
                {
                  id: "c1",
                  first_name: "Тестовий",
                  last_name: "Виконавець",
                  phone: "+380000000000",
                  status: "active",
                  region_name: "Дніпро",
                  created_at: date(-48),
                },
              ]
            : table === "admin_users"
              ? [{ user_id: "local-fixture", role: "owner", is_active: true }]
              : [];
    for (const [key, value] of url.searchParams)
      if (value.startsWith("eq."))
        rows = rows.filter((r) => String(r[key]) === value.slice(3));
    const or = url.searchParams.get("or");
    if (or) {
      const q = or.match(/ilike\.%([^%]+)%/)?.[1];
      if (q)
        rows = rows.filter((r) =>
          JSON.stringify(r).toLowerCase().includes(q.toLowerCase()),
        );
    }
    if (url.searchParams.has("limit"))
      rows = rows.slice(0, Number(url.searchParams.get("limit")));
    const headers = new Headers(
      init?.headers || (input instanceof Request ? input.headers : undefined),
    );
    if (headers.get("accept")?.includes("object+json"))
      return json(rows[0] || null);
    return json(rows);
  }
  if (url.origin === new URL(import.meta.env.VITE_SUPABASE_URL).origin)
    return json({});
  return realFetch(input, init);
};
const { supabase } = await import("../src/lib/supabase");
const { default: App } = await import("../src/App");
await import("../src/index.css");
await import("../src/workspace/workspace.css");
const session: any = {
  access_token: "local-fixture",
  user: { id: "local-fixture", email: "demo@example.test" },
};
supabase.auth.getSession = async () => ({ data: { session }, error: null });
supabase.auth.onAuthStateChange = (() => ({
  data: { subscription: { unsubscribe() {} } },
})) as any;
supabase.channel = (() => {
  const channel = {
    on() {
      return channel;
    },
    subscribe() {
      return channel;
    },
    unsubscribe() {},
  };
  return channel;
}) as any;
supabase.removeChannel = (async () => "ok") as any;
if (new URLSearchParams(location.search).get("fixture") === "login")
  supabase.auth.getSession = async () => ({
    data: { session: null },
    error: null,
  });
createRoot(document.getElementById("root")!).render(<App />);

// Development-only browser QA. This entry is not included in the production build.
const sid = "40000000-0000-0000-0000-000000000001";
const site = {
  id: sid,
  label: "АЗК WOG 0013",
  address: "м. Дніпро, вул. Прикладна, 13",
  capacity_m3: 15,
  passport_network: "WOG",
  passport_azk_code: "0013",
  region: "Дніпро · Дніпропетровська область",
  code: "0013",
};
const act = {
  act_id: "60000000-0000-0000-0000-000000000001",
  site_id: sid,
  site_label: site.label,
  work_date: "2026-11-10",
  pumped_m3: 10,
  act_number: "А-0220",
  application_number: "G-0220",
};
const app = {
  id: "30000000-0000-0000-0000-000000000001",
  application_number: "G-0220",
  title: site.label,
  description: "Відкачка РПВ. Текст менеджера без змін.",
  address: site.address,
  status: "assigned",
  contractor_stage: "offered",
  scheduled_at: "2026-11-18T00:00:00Z",
  deadline_at: null,
  actual_volume: null,
  updated_at: "2026-11-10T00:00:00Z",
  customer_site_id: sid,
};
window.Telegram = {
  WebApp: {
    initData: "local-test-only",
    ready() {},
    expand() {},
    openTelegramLink() {},
  },
};
const createdApps: (typeof app)[] = [];
const fetchReal = window.fetch.bind(window);
window.fetch = async (input, init) => {
  if (!String(input).endsWith("/rpv-portal")) return fetchReal(input, init);
  const b = JSON.parse(String(init?.body));
  if (b.action === "customer.calendar") {
    const rows = [app, ...createdApps].map((a) => ({ ...a, calendar_day: a.scheduled_at.slice(0, 10), visit_at: a.scheduled_at, site_label: site.label, network: "WOG", site_code: "0013", date_kind: "scheduled", awaiting_act: false, published: false }));
    const events = rows.filter((r) => r.calendar_day.startsWith(b.month) && (!b.query || `WOG 0013`.toLowerCase().includes(b.query.toLowerCase())));
    return new Response(JSON.stringify({ events, more: false, next: rows[0], today: "2026-11-11", month: b.month }), { headers: { "Content-Type": "application/json" } });
  }
  if (b.action === "customer.create") {
    const row = {
      ...app,
      id: b.request,
      application_number: "G-WEB001",
      description: b.work,
      scheduled_at: b.date + "T00:00:00Z",
      status: "new",
      contractor_stage: "unassigned",
    };
    if (!createdApps.some((a) => a.id === row.id)) createdApps.unshift(row);
    return new Response(
      JSON.stringify({
        id: row.id,
        application_number: row.application_number,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }
  if (b.action.startsWith("office.")) {
    const customers = [
      {
        telegram_id: 123,
        first_name: "Тестовий менеджер",
        last_name: "АЗК",
        username: "example_test",
        phone: "+380000000000",
        status: b.status,
        updated_at: "2026-11-10T00:00:00Z",
      },
    ];
    return new Response(
      JSON.stringify(
        b.action === "office.list"
          ? { customers, more: false, canManage: true }
          : b.action === "office.sites"
            ? { sites: [site], more: false }
            : b.action === "office.applications"
              ? {
                  applications: [{ ...app, customer_site_id: null }],
                  more: false,
                }
              : { ok: true, notificationSent: true, notifications: null },
      ),
      { headers: { "Content-Type": "application/json" } },
    );
  }
  const data =
    b.action === "identity"
      ? { roles: ["customer", "contractor"], name: "Тестовий замовник" }
      : b.action === "customer.dashboard"
        ? {
            name: "Тестовий замовник",
            sites: [site],
            sitesMore: false,
            acts: [act],
            more: false,
            total: 10,
            month: "2026-11",
            months: [{ month_start: "2026-10-01" }],
            monthsMore: false,
          }
        : b.action === "contractor.dashboard" ||
            b.action === "customer.applications"
          ? {
              applications: createdApps.length ? createdApps : [app],
              more: false,
            }
          : b.action === "contractor.transition"
            ? ((app.contractor_stage =
                b.transition === "accept" ? "accepted" : "departed"),
              { ok: true })
            : { ok: true };
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};
if (new URLSearchParams(location.search).has("office")) {
  const [{ createElement }, { createRoot }, { default: Customers }] =
    await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("../src/portal/Customers"),
    ]);
  await import("../src/index.css");
  createRoot(document.getElementById("root")!).render(createElement(Customers));
} else await import("../src/main");

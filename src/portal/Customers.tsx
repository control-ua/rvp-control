import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { portal, type Customer, type Site, type Application } from "./api";
import { Pager } from "./Portal";
import CustomerDetails, { SitePassport } from "./CustomerDetails";
import "./portal.css";
export default function Customers() {
  const [tab, setTab] = useState("pending"),
    [customers, setCustomers] = useState<Customer[]>([]),
    [sites, setSites] = useState<Site[]>([]),
    [page, setPage] = useState(0),
    [more, setMore] = useState(false),
    [query, setQuery] = useState(""),
    [searched, setSearched] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [canManage, setCanManage] = useState(false),
    [openedCustomer, setOpenedCustomer] = useState<Customer | null>(null),
    [passport, setPassport] = useState<Site | null>(null),
    [selected, setSelected] = useState<Site | null>(null),
    [apps, setApps] = useState<Application[]>([]),
    [appPage, setAppPage] = useState(0),
    [appsMore, setAppsMore] = useState(false);
  const refresh = () => {
    setBusy(true);
    setError("");
    return (
      tab === "sites"
        ? searched
          ? portal<{ sites: Site[]; more: boolean }>("office.sites", {
              query: searched,
              page,
            }).then((r) => {
              setSites(r.sites);
              setMore(r.more);
            })
          : Promise.resolve()
        : portal<{ customers: Customer[]; more: boolean; canManage: boolean }>(
            "office.list",
            { status: tab, page },
          ).then((r) => {
            setCustomers(r.customers);
            setMore(r.more);
            setCanManage(r.canManage);
          })
    )
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    void refresh();
  }, [tab, page, searched]);
  useEffect(() => {
    setApps([]);
    if (!selected) return;
    portal<{ applications: Application[]; more: boolean }>(
      "office.applications",
      { page: appPage },
    )
      .then((r) => {
        setApps(r.applications);
        setAppsMore(r.more);
      })
      .catch((e) => setError(e.message));
  }, [selected?.id, appPage]);
  async function decide(c: Customer, decision: string) {
    if (
      decision === "reset" &&
      !confirm(
        `Скинути реєстрацію ${c.first_name || c.phone}? Доступ буде відкликано. Паспорти та акти збережуться.`,
      )
    )
      return;
    setBusy(true);
    try {
      const result = await portal<{ notificationSent: boolean }>(
        "office.decide",
        { user: c.telegram_id, version: c.updated_at, decision },
      );
      await refresh();
      if (!result.notificationSent)
        setError("Контакт оновлено. Сповіщення в Telegram не доставлено.");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function link(a: Application) {
    if (
      !selected ||
      !confirm(
        `Прив’язати заявку ${a.application_number} (${a.title}, ${a.address}) до ${selected.label} (${selected.address})? Користувачі з доступом до АЗК побачать цю заявку.`,
      )
    )
      return;
    setBusy(true);
    try {
      await portal("office.link", {
        application: a.id,
        site: selected.id,
        version: a.updated_at,
      });
      setSelected(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (openedCustomer) return <CustomerDetails key={openedCustomer.telegram_id} customer={openedCustomer} onBack={() => setOpenedCustomer(null)} />;
  if (passport) return <div className="rpv-office"><SitePassport site={passport} onBack={() => setPassport(null)} /></div>;
  return (
    <div className="rpv-office">
      <h1>Замовники</h1>
      <p>Підтвердження контактів, паспорти АЗК та доступ до заявок.</p>
      <nav className="rpv-tabs">
        {[
          ["pending", "Запити"],
          ["active", "Підтверджені"],
          ["rejected", "Відхилені"],
          ["sites", "Пошук АЗК"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setPage(0);
              setSelected(null);
              setMore(false);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p className="rpv-error" role="alert">
          {error}
        </p>
      )}
      {tab === "sites" ? (
        <>
          <form
            className="rpv-office-form"
            onSubmit={(e) => {
              e.preventDefault();
              setSearched(query.trim());
              setPage(0);
              setSelected(null);
            }}
          >
            <input
              aria-label="Пошук мережі або АЗК"
              placeholder="Мережа латиницею або код АЗК"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button disabled={busy}>Знайти</button>
          </form>
          {sites.map((s) => (
            <article key={s.id}>
              <h2><button className="rpv-card-open" onClick={() => setPassport(s)}>
                <span>{s.label}<small>Відкрити паспорт об’єкта</small></span>
                <ArrowRight size={20} aria-hidden="true" />
              </button></h2>
              <p>{s.region}</p>
              <p>{s.address}</p>
              <p>Септик: {s.capacity_m3 ?? "—"} м³</p>
              <div className="rpv-office-actions">
                <button
                  disabled={busy}
                  onClick={() => {
                    setSelected(s);
                    setAppPage(0);
                  }}
                >
                  Прив’язати заявку
                </button>
              </div>
            </article>
          ))}
          {selected && (
            <article>
              <h2>Прив’язка до {selected.label}</h2>
              <p>
                Перевірте мережу, код та адресу. Автоматичного перенесення
                історії немає.
              </p>
              {apps.map((a) => (
                <div key={a.id} className="rpv-publish">
                  <p>
                    <b>
                      {a.application_number} · {a.title}
                    </b>
                  </p>
                  <p>{a.address}</p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{a.description}</p>
                  <button
                    disabled={busy || !!a.customer_site_id}
                    onClick={() => link(a)}
                  >
                    {a.customer_site_id
                      ? "Уже прив’язано"
                      : "Підтвердити прив’язку"}
                  </button>
                </div>
              ))}
              <Pager page={appPage} more={appsMore} change={setAppPage} />
              <Publish site={selected} report={setError} />
            </article>
          )}
        </>
      ) : (
        customers.map((c) => (
          <article key={c.telegram_id}>
            <h2>
              <button className="rpv-card-open" onClick={() => setOpenedCustomer(c)}>
                <span>{[c.first_name, c.last_name].filter(Boolean).join(" ") || "Без імені"}<small>Об’єкти та паспорти АЗК</small></span>
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            </h2>
            <p>
              <a href={`tel:${c.phone}`}>{c.phone}</a>
            </p>
            <p>
              <a
                href={
                  c.username && /^[a-zA-Z0-9_]{5,32}$/.test(c.username)
                    ? `https://t.me/${c.username}`
                    : `https://t.me/+${c.phone.replace(/\D/g, "")}`
                }
                target="_blank"
                rel="noreferrer"
              >
                Написати в Telegram ↗
              </a>
            </p>
            {canManage && (
              <div className="rpv-office-actions">
                {tab === "pending" && (
                  <>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => decide(c, "approve")}
                    >
                      Підтвердити контакт
                    </button>
                    <button disabled={busy} onClick={() => decide(c, "reject")}>
                      Відхилити
                    </button>
                  </>
                )}
                <button disabled={busy} onClick={() => decide(c, "reset")}>
                  Скинути реєстрацію
                </button>
              </div>
            )}
          </article>
        ))
      )}
      {!busy && tab !== "sites" && !customers.length && (
        <p>Записів поки немає.</p>
      )}
      <Pager page={page} more={more} change={setPage} />
      <button disabled={busy} onClick={refresh}>
        Оновити
      </button>
    </div>
  );
}
function Publish({
  site,
  report,
}: {
  site: Site;
  report: (message: string) => void;
}) {
  const [act, setAct] = useState(""),
    [date, setDate] = useState(""),
    [volume, setVolume] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    setBusy(true);
    try {
      const r = await portal<{ notifications: { failed: number } | null }>(
        "office.publish",
        { site: site.id, act, date, volume: volume ? Number(volume) : null },
      );
      setDone(true);
      if (r.notifications?.failed)
        report("Акт опубліковано. Частину сповіщень не доставлено.");
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="rpv-publish" onSubmit={submit}>
      <h3>Опублікувати підтверджений акт замовнику</h3>
      <p>
        Адреса заявки має збігатися з паспортом. Повторна публікація не збільшує
        лічильник двічі.
      </p>
      <div className="rpv-office-form">
        <label>
          Номер акта
          <input
            required
            value={act}
            onChange={(e) => setAct(e.target.value)}
          />
        </label>
        <label>
          Дата виконання
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Обсяг, м³
          <input
            type="number"
            min="0.001"
            max="999999"
            step="0.001"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            placeholder="Без відкачки — порожньо"
          />
        </label>
      </div>
      <button disabled={busy}>Опублікувати акт</button>
      {done && <p role="status">Акт опубліковано.</p>}
    </form>
  );
}

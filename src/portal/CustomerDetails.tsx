import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Phone, Send, UserRound } from "lucide-react";
import { portal, fmt, type Customer, type Site } from "./api";
import { contactLinks, type RegisteredContact } from "./contact";
import { Pager } from "./Portal";

export function SitePassport({ site, onBack }: { site: Site; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [loaded, setLoaded] = useState<{ id: string; contacts: RegisteredContact[] } | null>(null);
  const [contactError, setContactError] = useState<{ id: string; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const contacts = site.contacts ?? (loaded?.id === site.id ? loaded.contacts : null);
  useEffect(() => { heading.current?.focus(); }, [site.id]);
  useEffect(() => {
    if (site.contacts !== undefined) return;
    let active = true;
    setContactError(null);
    portal<{ site: Site }>('office.site', { site: site.id })
      .then(({ site: passport }) => { if (active) setLoaded({ id: site.id, contacts: passport.contacts || [] }); })
      .catch((e) => { if (active) setContactError({ id: site.id, message: e.message }); });
    return () => { active = false; };
  }, [site.id, site.contacts, retry]);
  return (
    <section className="rpv-office-details" aria-labelledby="rpv-passport-title">
      <button className="rpv-back" onClick={onBack}>
        <ArrowLeft size={16} /> До списку об’єктів
      </button>
      <p className="rpv-eyebrow">ПАСПОРТ ОБ’ЄКТА</p>
      <h1 id="rpv-passport-title" ref={heading} tabIndex={-1}>
        АЗК {site.passport_network} {site.code}
      </h1>
      <article>
        <dl className="rpv-passport">
          <div><dt>Мережа</dt><dd>{site.passport_network || "—"}</dd></div>
          <div><dt>Регіон</dt><dd>{site.region || "—"}</dd></div>
          <div><dt>Код АЗК</dt><dd>{site.code}</dd></div>
          <div><dt>Повна адреса</dt><dd>{site.address || "—"}</dd></div>
          <div><dt>Об’єм септика</dt><dd>{site.capacity_m3 == null ? "—" : `${fmt(site.capacity_m3)} м³`}</dd></div>
        </dl>
      </article>
      <section className="rpv-passport-contacts" aria-labelledby="rpv-contacts-title">
        <h2 id="rpv-contacts-title"><UserRound size={19} /> Контакти об’єкта</h2>
        {contactError?.id === site.id ? <p className="rpv-error" role="alert">{contactError.message} <button onClick={() => setRetry(v => v + 1)}>Повторити</button></p>
          : contacts === null ? <p role="status">Завантажуємо контакти…</p>
          : contacts.length === 0 ? <p>Менеджера до цього об’єкта ще не прив’язано.</p>
          : contacts.map(contact => {
            const links = contactLinks(contact);
            const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Ім’я не вказано';
            return <article className="rpv-passport-contact" key={contact.telegram_id}>
              <p>Менеджер АЗК · ім’я при реєстрації</p>
              <h3>{name}</h3>
              <div className="rpv-contact-info">
                {links.phone ? <a href={`tel:${links.phone}`}>{contact.phone}</a> : <span>Телефон не вказано</span>}
                {links.username && <span>@{links.username}</span>}
              </div>
              <div className="rpv-contact-actions">
                {links.phone && <a href={`tel:${links.phone}`} aria-label={`Зателефонувати: ${name}`}><Phone size={17} /> Зателефонувати</a>}
                {links.telegram && <a href={links.telegram} target="_blank" rel="noopener noreferrer" aria-label={`Telegram: ${name}`}><Send size={17} /> Telegram</a>}
              </div>
            </article>;
          })}
      </section>
    </section>
  );
}

export default function CustomerDetails({ customer, onBack, onOpenSite }: { customer: Customer; onBack: () => void; onOpenSite?: (site: Site) => void }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Site | null>(null);
  const [network, setNetwork] = useState("");
  const [networks, setNetworks] = useState<string[]>([]);
  const [networksError, setNetworksError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (!selected) heading.current?.focus(); }, [selected]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setMore(false);
    portal<{ sites: Site[]; more: boolean }>("office.sites", { user: customer.telegram_id, page, network })
      .then((r) => { if (active) { setSites(r.sites); setMore(r.more); } })
      .catch((e) => { if (active) { setError(e.message); setSites([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [customer.telegram_id, page, network, revision]);
  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible" && !loading && !selected) setRevision((v) => v + 1);
    };
    const timer = window.setInterval(update, 15000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [loading, selected]);
  useEffect(() => {
    let active = true;
    setNetworksError("");
    portal<{ networks: string[] }>("office.networks", { user: customer.telegram_id })
      .then((r) => { if (active) setNetworks(r.networks); })
      .catch((e) => { if (active) { setNetworksError(e.message); setNetworks([]); } });
    return () => { active = false; };
  }, [customer.telegram_id, revision]);
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "Без імені";
  return (
    <div className="rpv-office">
      {selected ? <SitePassport site={selected} onBack={() => { setSelected(null); setRevision((v) => v + 1); }} /> : (
        <section aria-labelledby="rpv-customer-title">
          <button className="rpv-back" onClick={onBack}><ArrowLeft size={16} /> До менеджерів АЗК</button>
          <p className="rpv-eyebrow">КАРТКА МЕНЕДЖЕРА АЗК</p>
          <h1 id="rpv-customer-title" ref={heading} tabIndex={-1}>{name}</h1>
          <p><a href={`tel:${customer.phone}`}>{customer.phone}</a></p>
          <h2 className="rpv-customer-sites-title">Об’єкти та паспорти АЗК</h2>
          <label className="rpv-network-filter">
            Мережа АЗК
            <select aria-label="Мережа АЗК" value={network} onChange={(e) => { setNetwork(e.target.value); setPage(0); setSites([]); setMore(false); }}>
              <option value="">Усі мережі</option>
              {networks.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          {networksError && <p className="rpv-error" role="alert">{networksError}</p>}
          {loading && <p role="status">Завантажуємо об’єкти…</p>}
          {error && <p className="rpv-error" role="alert">{error}</p>}
          {!loading && !error && !sites.length && <p>{network ? "АЗК цієї мережі у менеджера немає." : "Закріплених об’єктів поки немає."}</p>}
          {sites.map((s) => (
            <article key={s.id}>
              <h2><button className="rpv-card-open" onClick={() => onOpenSite ? onOpenSite(s) : setSelected(s)}>
                <span>АЗК {s.passport_network} {s.code}<small>Відкрити паспорт об’єкта</small></span>
                <ArrowRight size={20} aria-hidden="true" />
              </button></h2>
              <p>{s.address}</p>
              <p>{s.region}</p>
            </article>
          ))}
          {!loading && !error && <Pager page={page} more={more} change={(v) => { setSites([]); setPage(v); }} />}
          <button disabled={loading} onClick={() => setRevision((v) => v + 1)}>Оновити</button>
        </section>
      )}
    </div>
  );
}

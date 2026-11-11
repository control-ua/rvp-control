import { useEffect, useRef, useState } from "react";
import { portal, type Site } from "./api";
export default function CreateApplication({
  sites,
  selected,
  sitesMore,
  initialDate,
  onDone,
  onClose,
}: {
  sites: Site[];
  selected: Site | null;
  sitesMore: boolean;
  initialDate?: string;
  onDone: (site: Site, number: string) => void;
  onClose: () => void;
}) {
  const [siteId, setSiteId] = useState(selected?.id || sites[0]?.id || "");
  const [work, setWork] = useState("Відкачка РПВ");
  const [date, setDate] = useState(
    initialDate || new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef(crypto.randomUUID()),
    pending = useRef(false),
    frozen = useRef(false);
  const today = new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Kyiv",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const lastDay = new Date(today+"T12:00:00Z"); lastDay.setUTCDate(lastDay.getUTCDate()+366);
  const firstField = useRef<HTMLSelectElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  const available =
    selected && !sites.some((s) => s.id === selected.id)
      ? [selected, ...sites]
      : sites;
  const site = available.find((s) => s.id === siteId);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending.current) onClose();
      if (e.key === "Tab") {
        const controls = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled)",
          ) || [],
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current || !site) return;
    pending.current = true;
    frozen.current = true;
    setBusy(true);
    setError("");
    try {
      const row = await portal<{ id: string; application_number: string }>(
        "customer.create",
        { site: site.id, work, date, request: request.current },
      );
      onDone(site, row.application_number);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="rpv-modal-backdrop">
      <div
        ref={dialog}
        className="rpv-card rpv-create"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
      >
        <div className="rpv-section-title">
          <h2 id="create-title">Створити заявку</h2>
          <button
            type="button"
            aria-label="Закрити форму"
            disabled={busy}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <p className="rpv-hint">
          Оберіть свою АЗК та опишіть потрібні роботи. Адресу й контакт буде
          додано з реєстрації.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="request-site">АЗК</label>
          <select
            id="request-site"
            ref={firstField}
            required
            value={siteId}
            disabled={busy || frozen.current}
            onChange={(e) => setSiteId(e.target.value)}
          >
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.passport_network} · {s.code}
              </option>
            ))}
          </select>
          {sitesMore && (
            <p className="rpv-hint">
              Показано поточну сторінку АЗК. Якщо потрібної немає, закрийте
              форму й відкрийте її картку.
            </p>
          )}
          {site && (
            <div className="rpv-create-site">
              <strong>{site.label}</strong>
              <p>{site.address}</p>
              {site.capacity_m3 != null && (
                <small>Септик за паспортом: {site.capacity_m3} м³</small>
              )}
            </div>
          )}
          <label htmlFor="request-work">Які роботи потрібні?</label>
          <textarea
            id="request-work"
            required
            maxLength={2000}
            rows={4}
            value={work}
            disabled={busy || frozen.current}
            onChange={(e) => setWork(e.target.value)}
            placeholder="Відкачка РПВ, прочистка, додаткові побажання…"
          />
          <label htmlFor="request-date">Бажана дата</label>
          <input
            id="request-date"
            type="date"
            min={today}
            max={lastDay.toISOString().slice(0,10)}
            required
            value={date}
            disabled={busy || frozen.current}
            onChange={(e) => setDate(e.target.value)}
          />
          <p className="rpv-hint">Час і виконавця узгодить офіс.</p>
          {error && (
            <p className="rpv-error" role="alert">
              {error}
            </p>
          )}
          {frozen.current && !busy && error && (
            <p className="rpv-hint">
              Повторне надсилання перевірить цю саму заявку без дублювання. Для
              зміни даних закрийте форму й відкрийте нову.
            </p>
          )}
          <div className="rpv-create-actions">
            <button type="button" disabled={busy} onClick={onClose}>
              Скасувати
            </button>
            <button
              className="primary"
              disabled={busy || !site || !work.trim()}
            >
              {busy
                ? "Надсилаємо…"
                : frozen.current
                  ? "Повторити надсилання"
                  : "Створити заявку"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { portal, type Site } from "@/portal/api";
import { SitePassport } from "@/portal/CustomerDetails";
import { fetchApplications } from "@/lib/applicationsApi";
import type { Application } from "@/types";
import { formatDate } from "@/utils/helpers";
export default function ObjectProfile({
  id,
  onBack,
  onOpenApplication,
}: {
  id: string;
  onBack: () => void;
  onOpenApplication: (id: string) => void;
}) {
  const [site, setSite] = useState<Site | null>(null),
    [apps, setApps] = useState<Application[]>([]);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const serial = useRef(0);
  const load = useCallback(async () => {
    const request = ++serial.current;
    setLoading(true);
    try {
      const [s, a] = await Promise.all([
        portal<{ site: Site }>("office.site", { site: id }),
        fetchApplications(id),
      ]);
      if (request === serial.current) {
        setSite(s.site);
        setApps(a);
        setError("");
      }
    } catch (e) {
      if (request === serial.current) setError((e as Error).message);
    } finally {
      if (request === serial.current) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    setSite(null);
    setApps([]);
    void load();
    return () => {
      serial.current++;
    };
  }, [load]);
  return (
    <div className="rpv-office">
      {error && (
        <div className="ws-error" role="alert">
          {error}
          <button onClick={() => void load()}>Повторити</button>
        </div>
      )}
      {!site && (
        <>
          <button className="rpv-back" onClick={onBack}>
            До списку об’єктів
          </button>
          {loading && <p role="status">Завантажуємо паспорт…</p>}
        </>
      )}
      {site && (
        <>
          <SitePassport site={site} onBack={onBack} />
          <section className="ws-passport-apps">
            <div className="ws-section-label">
              <h2>Заявки цього об’єкта · {apps.length}</h2>
              <button disabled={loading} onClick={() => void load()}>
                <RefreshCw size={15} /> Оновити
              </button>
            </div>
            <p>
              Історія робіт, результати та перехід до актів — у картці заявки.
            </p>
            {!apps.length && !error && (
              <div className="ws-empty">Пов’язаних заявок поки немає.</div>
            )}
            {apps.map((app) => (
              <div className="ws-work-row" key={app.id}>
                <div>
                  <span className="ws-tag">{app.status}</span>
                  <button
                    className="ws-record-title"
                    onClick={() => onOpenApplication(app.id)}
                  >
                    {app.number} · {app.customer}
                  </button>
                  <p>{app.description || "Опис робіт не вказано"}</p>
                  <small>
                    {formatDate(app.date)} ·{" "}
                    {app.contractorName === "—"
                      ? "Без виконавця"
                      : app.contractorName}
                  </small>
                </div>
                <button onClick={() => onOpenApplication(app.id)}>
                  Відкрити <ArrowRight size={16} />
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

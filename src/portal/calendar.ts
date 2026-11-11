import type { Application } from "./api.ts";
export type Visit = Application & {
  site_label: string; network: string | null; site_code: string | null;
  visit_at: string; calendar_day: string; date_kind: "scheduled" | "deadline";
  published: boolean; awaiting_act: boolean;
};
export type CalendarData = { events: Visit[]; more: boolean; next: Visit | null; today: string; month: string };
export function shiftMonth(month: string, offset: number) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}
export function monthDays(month: string): (string | null)[] {
  const first = new Date(`${month}-01T12:00:00Z`);
  const padding = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(padding).fill(null);
  for (let day = 1; day <= count; day++) cells.push(`${month}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function visitStatus(v: Visit, today: string) {
  if (["cancelled", "canceled", "Скасована"].includes(v.status)) return { tone: "muted", label: "Скасовано" };
  if (v.published) return { tone: "done", label: "Виконано · акт опубліковано" };
  if (v.awaiting_act || ["completed", "done", "Виконана"].includes(v.status)) return { tone: "review", label: "Результат на перевірці" };
  if (v.contractor_stage === "problem" || v.calendar_day < today) return { tone: "attention", label: v.contractor_stage === "problem" ? "Потребує уваги офісу" : "Дата минула · уточнюємо стан" };
  if (v.contractor_stage === "departed") return { tone: "assigned", label: "Виконавець виїхав" };
  if (["accepted", "offered"].includes(v.contractor_stage) || ["assigned", "in_progress", "Прийнята", "В роботі"].includes(v.status)) return { tone: "assigned", label: "Виконавця призначено" };
  return { tone: "planned", label: "Бажана дата · очікує узгодження" };
}
export function visitDayLabel(day: string) {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

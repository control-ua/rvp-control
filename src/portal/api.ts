import { supabase } from "@/lib/supabase";
export const BOT_URL = "https://t.me/GService_zayavki_bot";
export type Site = {
  id: string;
  label: string;
  address: string;
  capacity_m3: number | null;
  passport_network: string | null;
  region: string;
  code: string;
};
export type Act = {
  act_id: string;
  site_id: string;
  site_label: string;
  work_date: string;
  pumped_m3: number | null;
  act_number: string;
  application_number: string;
};
export type Application = {
  id: string;
  application_number: string;
  title: string;
  description: string;
  address: string;
  status: string;
  contractor_stage: string;
  scheduled_at: string | null;
  deadline_at: string | null;
  actual_volume: number | null;
  updated_at: string;
  customer_site_id: string | null;
  report_state?: string;
  review_reason?: string;
  arrived_at?: string | null;
  awaiting_act?: boolean;
  has_problem?: boolean;
  problem_comment?: string | null;
  payout_amount?: number;
  payout_status?: string;
  paid_at?: string | null;
  customer_contact?: {name:string;phone:string;username:string|null} | null;
};
export type Customer = {
  telegram_id: number;
  first_name: string;
  last_name: string;
  username: string | null;
  phone: string;
  status: string;
  updated_at: string;
};
export type Dashboard = {
  name: string;
  sites: Site[];
  sitesMore: boolean;
  acts: Act[];
  more: boolean;
  total: number;
  month: string;
  months: { month_start: string }[];
  monthsMore: boolean;
};
type WebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  openTelegramLink: (url: string) => void;
};
declare global {
  interface Window {
    Telegram?: { WebApp?: WebApp };
  }
}
const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rpv-portal`;
export async function portal<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (action.startsWith("office.")) {
    const { data } = await supabase.auth.getSession();
    if (data.session)
      headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      action,
      ...body,
      initData: window.Telegram?.WebApp?.initData || "",
    }),
  });
  if (!response.ok) {
    const e = await response.json().catch(() => ({}));
    throw new Error(e.error || "Не вдалося отримати дані.");
  }
  return response.json();
}
export async function downloadAct(act: Act) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "customer.file",
      act: act.act_id,
      initData: window.Telegram?.WebApp?.initData || "",
    }),
  });
  if (!response.ok) {
    const e = await response.json();
    throw new Error(e.error || "Файл недоступний.");
  }
  const blob = await response.blob(),
    url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Акт-${act.act_number || act.work_date}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export function openBot() {
  if (window.Telegram?.WebApp?.initData)
    window.Telegram.WebApp.openTelegramLink(BOT_URL);
  else window.location.href = BOT_URL;
}
export function currentMonth() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}
export function monthName(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));
}
export const fmt = (n: number | null) =>
  Number(n || 0).toLocaleString("uk-UA", { maximumFractionDigits: 3 });
export function statusLabel(value: string) {
  return (
    (
      {
        new: "Нова",
        assigned: "Призначено",
        in_progress: "У роботі",
        completed: "Виконано",
        cancelled: "Скасовано",
        offered: "Очікує прийняття",
        accepted: "Прийнято",
        departed: "Виїхав",
        declined: "Відмова",
        unassigned: "Без виконавця",
        problem: "Проблема",
      } as Record<string, string>
    )[value] || value
  );
}

export async function uploadResult(application:string,request:string,file:File) {
  const body=new FormData();body.set("initData",window.Telegram?.WebApp?.initData||"");body.set("application",application);body.set("request",request);body.set("file",file);
  const r=await fetch(endpoint,{method:"POST",body});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||"Файл не передано. Повторіть спробу.");}
  return r.json();
}

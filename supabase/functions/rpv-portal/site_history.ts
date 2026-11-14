import { PortalError } from './auth.ts';

export const historyPageSize = 50;
export const historySiteFields = 'id,label,address,capacity_m3,passport_network,passport_city_code,passport_azk_code,merged_into';
export type HistoryApplication = {
  id: string; application_number: string | null; title: string; description: string | null;
  status: string; created_at: string; scheduled_at: string | null; actual_volume: number | null;
  customer_site_id: string; contractor: { first_name: string | null; last_name: string | null } | null;
  acts: { id: string; act_number: string | null; status: string; created_at: string }[];
  work_history: { completed_at: string }[];
};

function checked<T>(reply: { data: T; error: unknown }): T {
  if (reply.error) throw new PortalError(500, 'Не вдалося завантажити історію заявок. Спробуйте ще раз.');
  return reply.data;
}

// Old office URLs resolve to the retained passport. History uses only its ID.
// Call only after office authentication/role checks.
export async function resolveOfficeSite(db: any, id: string) {
  let selected = checked<any>(await db.from('rpv_customer_sites')
    .select(historySiteFields).eq('id', id).maybeSingle());
  if (selected?.merged_into) selected = checked<any>(await db.from('rpv_customer_sites')
    .select(historySiteFields).eq('id', selected.merged_into).maybeSingle());
  if (!selected) throw new PortalError(404, 'Об’єкт недоступний.');
  if (selected.merged_into) throw new PortalError(409, 'Паспорт змінився. Оновіть список об’єктів.');
  return selected;
}
export async function officeSiteHistory(db: any, id: string, page: number) {
  const selected = await resolveOfficeSite(db, id);
  const reply = await db.from('applications').select(`
    id,application_number,title,description,status,created_at,scheduled_at,actual_volume,customer_site_id,
    contractor:contractors(first_name,last_name),acts(id,act_number,status,created_at),work_history(completed_at)
  `, { count: 'exact' }).eq('customer_site_id', selected.id)
    .order('created_at', { ascending: false }).order('id')
    .range(page * historyPageSize, (page + 1) * historyPageSize - 1);
  const applications = checked<HistoryApplication[]>(reply);
  if (typeof reply.count !== 'number') throw new PortalError(500, 'Не вдалося визначити кількість заявок.');
  return { site: selected, applications, total: reply.count,
    more: (page + 1) * historyPageSize < reply.count };
}

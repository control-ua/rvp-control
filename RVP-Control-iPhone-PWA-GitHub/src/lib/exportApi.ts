import { supabase } from '@/lib/supabase';
import { normalizeStatus, normalizePayoutStatus } from '@/utils/helpers';

function csvEscape(value: string): string {
  const v = String(value ?? '');
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function downloadCsv(filename: string, rows: string[][]) {
  const BOM = '\uFEFF';
  const csv = BOM + rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportApplications(filters?: { dateFrom?: string; dateTo?: string; status?: string; contractorId?: string }): Promise<void> {
  let query = supabase.from('applications').select(`
    application_number, title, address, azk_code, status, payout_amount,
    payout_status, created_at, deadline_at,
    contractor:contractors ( first_name, last_name )
  `).order('created_at', { ascending: false });

  if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('created_at', filters.dateTo);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.contractorId) query = query.eq('contractor_id', filters.contractorId);

  const { data, error } = await query;
  if (error) throw new Error(`Експорт заявок: ${error.message}`);

  const rows: string[][] = [['Номер', 'Обʼєкт', 'Адреса', 'АЗК', 'Статус', 'Сума', 'Виплата', 'Створено', 'Дедлайн', 'Підрядник']];
  for (const row of (data ?? []) as unknown as any[]) {
    const name = [row.contractor?.first_name, row.contractor?.last_name].filter(Boolean).join(' ') || '—';
    rows.push([
      row.application_number ?? '—', row.title ?? '—', row.address ?? '—', row.azk_code ?? '—',
      normalizeStatus(row.status), String(Number(row.payout_amount) || 0), normalizePayoutStatus(row.payout_status),
      row.created_at ?? '—', row.deadline_at ?? '—', name,
    ]);
  }

  downloadCsv(`zayavky-${Date.now()}.csv`, rows);
}

export async function exportContractors(): Promise<void> {
  const { data, error } = await supabase.from('contractors').select(`
    first_name, last_name, phone, username, status, region_name, created_at,
    is_admin
  `).order('created_at', { ascending: false });

  if (error) throw new Error(`Експорт підрядників: ${error.message}`);

  const rows: string[][] = [['Імʼя', 'Прізвище', 'Телефон', 'Username', 'Статус', 'Регіон', 'Адмін', 'Створено']];
  for (const row of (data ?? []) as unknown as any[]) {
    rows.push([
      row.first_name ?? '—', row.last_name ?? '—', row.phone ?? '—', row.username ?? '—',
      row.status ?? '—', row.region_name ?? '—', row.is_admin ? 'Так' : 'Ні', row.created_at ?? '—',
    ]);
  }

  downloadCsv(`pidryadnyky-${Date.now()}.csv`, rows);
}

export async function exportPayouts(): Promise<void> {
  const { data, error } = await supabase.from('applications').select(`
    application_number, title, payout_amount, payout_status, paid_at,
    contractor:contractors ( first_name, last_name, phone )
  `).order('created_at', { ascending: false });

  if (error) throw new Error(`Експорт виплат: ${error.message}`);

  const rows: string[][] = [['Номер', 'Обʼєкт', 'Сума', 'Статус', 'Дата виплати', 'Підрядник', 'Телефон']];
  for (const row of (data ?? []) as unknown as any[]) {
    const name = [row.contractor?.first_name, row.contractor?.last_name].filter(Boolean).join(' ') || '—';
    rows.push([
      row.application_number ?? '—', row.title ?? '—', String(Number(row.payout_amount) || 0),
      normalizePayoutStatus(row.payout_status), row.paid_at ?? '—', name, row.contractor?.phone ?? '—',
    ]);
  }

  downloadCsv(`vyplaty-${Date.now()}.csv`, rows);
}

export async function exportActs(): Promise<void> {
  const { data, error } = await supabase.from('acts').select(`
    act_number, status, created_at, reviewed_at,
    contractor:contractors ( first_name, last_name ),
    application:applications ( application_number, title )
  `).order('created_at', { ascending: false });

  if (error) throw new Error(`Експорт актів: ${error.message}`);

  const rows: string[][] = [['Номер акта', 'Статус', 'Створено', 'Перевірено', 'Підрядник', 'Заявка', 'Обʼєкт']];
  for (const row of (data ?? []) as unknown as any[]) {
    const name = [row.contractor?.first_name, row.contractor?.last_name].filter(Boolean).join(' ') || '—';
    rows.push([
      row.act_number ?? '—', row.status ?? '—', row.created_at ?? '—', row.reviewed_at ?? '—',
      name, row.application?.application_number ?? '—', row.application?.title ?? '—',
    ]);
  }

  downloadCsv(`akty-${Date.now()}.csv`, rows);
}

export async function exportProblems(): Promise<void> {
  const { data, error } = await supabase.from('applications').select(`
    application_number, title, address, status, problem_comment, deadline_at, updated_at,
    contractor:contractors ( first_name, last_name )
  `).eq('has_problem', true).order('updated_at', { ascending: false });

  if (error) throw new Error(`Експорт проблем: ${error.message}`);

  const rows: string[][] = [['Номер', 'Обʼєкт', 'Адреса', 'Статус', 'Коментар проблеми', 'Дедлайн', 'Оновлено', 'Підрядник']];
  for (const row of (data ?? []) as unknown as any[]) {
    const name = [row.contractor?.first_name, row.first_name, row.contractor?.last_name].filter(Boolean).join(' ') || '—';
    rows.push([
      row.application_number ?? '—', row.title ?? '—', row.address ?? '—',
      normalizeStatus(row.status), row.problem_comment ?? '—', row.deadline_at ?? '—',
      row.updated_at ?? '—', name,
    ]);
  }

  downloadCsv(`problemy-${Date.now()}.csv`, rows);
}

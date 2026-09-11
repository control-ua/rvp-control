import { supabase } from '@/lib/supabase';
import { normalizeStatus, normalizePayoutStatus } from '@/lib/helpers';
import type {
  Application, ApplicationStatus, Contractor, Act, WorkHistoryEntry,
  ControlCenterItem, AppNotification, ApplicationFile, ApplicationComment,
} from '@/types';

interface ContractorRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  region_name: string | null;
  status: string | null;
}

interface ApplicationRow {
  id: string;
  application_number: string | null;
  azk_code: string | null;
  order_date_text: string | null;
  title: string;
  description: string | null;
  address: string | null;
  status: string;
  deadline_at: string | null;
  scheduled_at: string | null;
  manager_comment: string | null;
  actual_volume: number | null;
  unit_price: number | null;
  payout_amount: number | null;
  payout_status: string | null;
  payout_receipt_name: string | null;
  payout_receipt_file_id: string | null;
  payout_receipt_type: string | null;
  created_at: string;
  contractor_id: string | null;
  contractor: ContractorRow | null;
}

const APPLICATION_SELECT = `
  id, application_number, azk_code, order_date_text, title, description,
  address, status, deadline_at, scheduled_at, manager_comment, actual_volume,
  unit_price, payout_amount, payout_status, payout_receipt_name,
  payout_receipt_file_id, payout_receipt_type, created_at, contractor_id,
  contractor:contractors ( id, first_name, last_name, phone, region_name, status )
`;

function buildContractorName(c: ContractorRow | null): string {
  if (!c) return '—';
  const parts = [c.first_name, c.last_name].filter(p => p && p.trim());
  return parts.join(' ') || '—';
}

function mapRowToApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    number: row.application_number ?? '—',
    date: row.order_date_text ?? row.created_at,
    customer: row.title,
    address: row.address ?? '—',
    contractorId: row.contractor_id ?? '',
    contractorName: buildContractorName(row.contractor),
    contractorPhone: row.contractor?.phone ?? '—',
    status: normalizeStatus(row.status),
    amount: Number(row.payout_amount ?? 0),
    scheduledDate: row.scheduled_at ?? '',
    description: row.description ?? '',
    managerComment: row.manager_comment ?? '',
    actualVolume: Number(row.actual_volume ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    payoutAmount: Number(row.payout_amount ?? 0),
    payoutStatus: normalizePayoutStatus(row.payout_status ?? ''),
    azkCode: row.azk_code ?? undefined,
    deadline: row.deadline_at ?? undefined,
  };
}

export async function fetchApplications(): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(APPLICATION_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Не вдалося завантажити заявки: ${error.message}`);
  return ((data ?? []) as unknown as ApplicationRow[]).map(mapRowToApplication);
}

export async function fetchApplicationById(id: string): Promise<Application | null> {
  const { data, error } = await supabase
    .from('applications')
    .select(APPLICATION_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Не вдалося завантажити заявку: ${error.message}`);
  if (!data) return null;
  return mapRowToApplication(data as unknown as ApplicationRow);
}

export async function fetchContractors(): Promise<Contractor[]> {
  const { data, error } = await supabase
    .from('contractors')
    .select('id, first_name, last_name, phone, region_name, status, total_applications, completed_applications, total_payout')
    .order('first_name', { ascending: true });

  if (error) throw new Error(`Не вдалося завантажити підрядників: ${error.message}`);

  return (data ?? []).map((c: any) => ({
    id: c.id,
    name: [c.first_name, c.last_name].filter(Boolean).join(' ') || '—',
    phone: c.phone ?? '—',
    status: (c.status === 'active' ? 'active' : 'inactive') as 'active' | 'inactive',
    region: c.region_name ?? '—',
    totalApplications: c.total_applications ?? 0,
    completedApplications: c.completed_applications ?? 0,
    activeApplications: 0,
    totalPayout: Number(c.total_payout ?? 0),
  }));
}

export async function fetchLinkedActs(applicationId: string): Promise<Act[]> {
  const { data, error } = await supabase
    .from('acts')
    .select('id, act_number, status, created_at, contractor:contractors(first_name, last_name)')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Не вдалося завантажити акти: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    applicationId,
    applicationNumber: '',
    contractorName: row.contractor ? [row.contractor.first_name, row.contractor.last_name].filter(Boolean).join(' ') : '—',
    uploadDate: row.created_at,
    status: (row.status === 'approved' || row.status === 'pending' || row.status === 'rejected' ? row.status : 'pending') as Act['status'],
    actNumber: row.act_number ?? null,
  }));
}

export async function fetchWorkHistory(applicationId: string): Promise<WorkHistoryEntry[]> {
  const { data, error } = await supabase
    .from('work_history')
    .select('id, title, description, completed_at')
    .eq('application_id', applicationId)
    .order('completed_at', { ascending: false });

  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title ?? '',
    description: row.description ?? null,
    completedAt: row.completed_at,
  }));
}

export async function fetchApplicationFiles(applicationId: string): Promise<ApplicationFile[]> {
  const { data, error } = await supabase
    .from('application_files')
    .select('id, application_id, file_name, file_type, category, created_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    applicationId: row.application_id,
    fileName: row.file_name ?? '',
    fileType: row.file_type ?? '',
    category: (row.category ?? 'other') as ApplicationFile['category'],
    createdAt: row.created_at,
    url: null,
  }));
}

export async function fetchApplicationComments(applicationId: string): Promise<ApplicationComment[]> {
  const { data, error } = await supabase
    .from('application_comments')
    .select('id, application_id, message, created_at, admin:admin_users(full_name)')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    applicationId: row.application_id,
    adminName: row.admin?.full_name ?? 'Адміністратор',
    message: row.message ?? '',
    createdAt: row.created_at,
  }));
}

export async function insertApplicationComment(applicationId: string, message: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Не авторизовано');

  const { error } = await supabase
    .from('application_comments')
    .insert({
      application_id: applicationId,
      admin_user_id: session.user.id,
      message,
    });

  if (error) throw new Error('Не вдалося додати коментар');
}

export async function assignContractor(applicationId: string, contractorId: string): Promise<void> {
  const { data: contractor, error: contractorError } = await supabase
    .from('contractors')
    .select('id, telegram_id, status')
    .eq('id', contractorId)
    .maybeSingle();

  if (contractorError) throw new Error(`Помилка: ${contractorError.message}`);
  if (!contractor) throw new Error('Підрядника не знайдено');
  if (contractor.status !== 'active') throw new Error('Підрядник не активний');

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('applications')
    .update({
      contractor_id: contractorId,
      status: 'assigned',
      contractor_stage: 'accepted',
      accepted_at: now,
      updated_at: now,
    })
    .eq('id', applicationId);

  if (updateError) throw new Error(`Не вдалося призначити: ${updateError.message}`);

  await supabase.functions.invoke('smart-api', {
    body: { action: 'notify_application', application_id: applicationId },
  }).catch(() => {});
}

export async function fetchControlCenter(): Promise<ControlCenterItem[]> {
  const { data, error } = await supabase
    .from('applications')
    .select('id, application_number, title, address, status, contractor_id, contractor_stage, has_problem, deadline_at, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(`Помилка: ${error.message}`);

  const rows = (data ?? []) as any[];
  const items: ControlCenterItem[] = [];
  const now = new Date();

  for (const row of rows) {
    const num = row.application_number ?? '—';
    const ns = normalizeStatus(row.status);
    if (ns === 'Скасована' || ns === 'Виконана') continue;

    if (row.deadline_at && new Date(row.deadline_at) < now) {
      items.push({
        id: `${row.id}-overdue`, type: 'overdue',
        title: `Прострочено — ${num}`, description: row.title ?? '',
        applicationId: row.id, applicationNumber: num,
        severity: 'critical', createdAt: row.deadline_at,
      });
    }
    if (!row.contractor_id) {
      items.push({
        id: `${row.id}-no-contractor`, type: 'no_contractor',
        title: `Без підрядника — ${num}`, description: row.title ?? '',
        applicationId: row.id, applicationNumber: num,
        severity: 'warning', createdAt: row.created_at,
      });
    }
    if (row.has_problem || row.contractor_stage === 'problem') {
      items.push({
        id: `${row.id}-problem`, type: 'problem',
        title: `Проблема — ${num}`, description: row.title ?? '',
        applicationId: row.id, applicationNumber: num,
        severity: 'critical', createdAt: row.updated_at,
      });
    }
  }

  const { data: actData } = await supabase
    .from('acts')
    .select('id, application_id, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  if (actData) {
    for (const act of actData as any[]) {
      items.push({
        id: `${act.id}-act`, type: 'act_pending',
        title: 'Акт на перевірці', description: 'Очікує перевірки',
        applicationId: act.application_id ?? '', applicationNumber: '—',
        severity: 'info', createdAt: act.created_at,
      });
    }
  }

  const { data: payData } = await supabase
    .from('applications')
    .select('id, application_number, title, payout_amount, updated_at')
    .eq('payout_status', 'pending')
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (payData) {
    for (const pay of payData as any[]) {
      items.push({
        id: `${pay.id}-payout`, type: 'payout_pending',
        title: `Очікує виплату — ${pay.application_number ?? '—'}`,
        description: `${pay.title ?? ''} • ${Number(pay.payout_amount ?? 0).toLocaleString('uk-UA')} ₴`,
        applicationId: pay.id, applicationNumber: pay.application_number ?? '—',
        severity: 'warning', createdAt: pay.updated_at,
      });
    }
  }

  const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    return s !== 0 ? s : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return items;
}

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, application_id, read, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type ?? 'info',
    title: row.title ?? '',
    body: row.body ?? '',
    applicationId: row.application_id ?? null,
    read: row.read ?? false,
    createdAt: row.created_at,
  }));
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function fetchDashboardStats(): Promise<{
  newCount: number;
  inProgressCount: number;
  problemCount: number;
  overdueCount: number;
  recent: Application[];
}> {
  const { data, error } = await supabase
    .from('applications')
    .select(APPLICATION_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Помилка: ${error.message}`);

  const apps = ((data ?? []) as unknown as ApplicationRow[]).map(mapRowToApplication);
  const now = new Date();

  return {
    newCount: apps.filter(a => a.status === 'Нова').length,
    inProgressCount: apps.filter(a => a.status === 'В роботі' || a.status === 'Прийнята').length,
    problemCount: apps.filter(a => a.status === 'В роботі' && a.deadline && new Date(a.deadline) < now).length,
    overdueCount: apps.filter(a => a.deadline && new Date(a.deadline) < now && a.status !== 'Виконана' && a.status !== 'Скасована').length,
    recent: apps.slice(0, 10),
  };
}

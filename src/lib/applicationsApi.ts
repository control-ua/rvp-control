import { supabase } from '@/lib/supabase';
import type { Application } from '@/types';
import { normalizeStatus, normalizePayoutStatus } from '@/utils/helpers';

interface ContractorRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  region_name: string | null;
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
  unit_price: number;
  payout_amount: number;
  payout_status: string;
  payout_receipt_name: string | null;
  payout_receipt_file_id: string | null;
  payout_receipt_type: string | null;
  paid_at: string | null;
  created_at: string;
  contractor_id: string | null;
  contractor: ContractorRow | null;
}

const APPLICATION_SELECT = `
  id,
  application_number,
  azk_code,
  order_date_text,
  title,
  description,
  address,
  status,
  deadline_at,
  scheduled_at,
  manager_comment,
  actual_volume,
  unit_price,
  payout_amount,
  payout_status,
  payout_receipt_name,
  payout_receipt_file_id,
  payout_receipt_type,
  paid_at,
  created_at,
  contractor_id,
  contractor:contractors (
    id,
    first_name,
    last_name,
    phone,
    region_name
  )
`;

function buildContractorName(contractor: ContractorRow | null): string {
  if (!contractor) return '—';

  const parts = [
    contractor.first_name,
    contractor.last_name,
  ].filter(p => p && p.trim());

  return parts.join(' ') || '—';
}

function mapRowToApplication(row: ApplicationRow): Application {
  const contractorName = buildContractorName(row.contractor);
  const contractorPhone = row.contractor?.phone ?? '—';

  return {
    id: row.id,
    number: row.application_number ?? '—',
    date: row.order_date_text ?? row.created_at,
    customer: row.title,
    address: row.address ?? '—',
    contractorId: row.contractor_id ?? '',
    contractorName,
    contractorPhone,
    phone: contractorPhone,
    status: normalizeStatus(row.status),
    amount: Number(row.payout_amount ?? 0),
    scheduledDate: row.scheduled_at ?? '',
    description: row.description ?? '',
    managerComment: row.manager_comment ?? '',
    actualVolume: Number(row.actual_volume ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    payoutAmount: Number(row.payout_amount ?? 0),
    payoutStatus: normalizePayoutStatus(row.payout_status),
    payoutReceipt: row.payout_receipt_file_id ?? undefined,
    payoutReceiptName: row.payout_receipt_name ?? undefined,
    payoutReceiptType: row.payout_receipt_type ?? undefined,
    azkCode: row.azk_code ?? undefined,
    deadline: row.deadline_at ?? undefined,
  };
}

export async function fetchApplications(): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(APPLICATION_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Не вдалося завантажити заявки: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  return (data as unknown as ApplicationRow[]).map(mapRowToApplication);
}

export interface NewApplicationInput {
  applicationNumber: string;
  azkCode: string;
  orderDateText: string;
  title: string;
  description: string;
  address: string;
  status: string;
  deadlineAt: string;
  managerComment: string;
  contractorId: string;
  payoutAmount?: number;
}

export interface LinkedAct {
  id: string;
  actNumber: string | null;
  status: string;
  createdAt: string;
}

export interface WorkHistoryEntry {
  id: string;
  title: string;
  description: string | null;
  completedAt: string;
}

export async function fetchLinkedActs(applicationId: string): Promise<LinkedAct[]> {
  const { data, error } = await supabase
    .from('acts')
    .select('id, act_number, status, created_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Не вдалося завантажити акти: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    actNumber: row.act_number ?? null,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function fetchWorkHistory(applicationId: string): Promise<WorkHistoryEntry[]> {
  const { data, error } = await supabase
    .from('work_history')
    .select('id, title, description, completed_at')
    .eq('application_id', applicationId)
    .order('completed_at', { ascending: false });

  if (error) {
    throw new Error(`Не вдалося завантажити історію: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    completedAt: row.completed_at,
  }));
}

async function verifyContractor(contractorId: string) {
  const { data: contractor, error: contractorError } = await supabase
    .from('contractors')
    .select('id, telegram_id, status')
    .eq('id', contractorId)
    .maybeSingle();

  if (contractorError) {
    throw new Error(`Не вдалося перевірити підрядника: ${contractorError.message}`);
  }

  if (!contractor) {
    throw new Error('Підрядника не знайдено.');
  }

  if (contractor.status !== 'active') {
    throw new Error('Цей підрядник не активний.');
  }

  if (!contractor.telegram_id) {
    throw new Error('У підрядника немає Telegram ID. Спочатку він повинен відкрити бота.');
  }

  return contractor;
}

async function notifyAssignedApplication(applicationId: string): Promise<void> {
  const { data: notifyResult, error: notifyError } =
    await supabase.functions.invoke('smart-api', {
      body: {
        action: 'notify_application',
        application_id: applicationId,
      },
    });

  if (notifyError) {
    throw new Error(
      `Заявку призначено, але не вдалося надіслати сповіщення в Telegram: ${notifyError.message}`,
    );
  }

  if (notifyResult?.ok === false) {
    throw new Error(
      `Заявку призначено, але Telegram не отримав сповіщення: ${
        notifyResult?.error || 'невідома помилка'
      }`,
    );
  }
}

export async function insertApplication(
  input: NewApplicationInput,
): Promise<void> {
  if (!input.contractorId) {
    throw new Error('Оберіть підрядника для заявки.');
  }

  await verifyContractor(input.contractorId);

  const now = new Date().toISOString();

  const { data: application, error } = await supabase
    .from('applications')
    .insert({
      application_number: input.applicationNumber || null,
      azk_code: input.azkCode || null,
      order_date_text: input.orderDateText || null,
      title: input.title,
      description: input.description || null,
      address: input.address || null,
      status: 'assigned',
      contractor_stage: 'accepted',
      accepted_at: now,
      deadline_at: input.deadlineAt || null,
      scheduled_at: input.deadlineAt || null,
      manager_comment: input.managerComment || null,
      contractor_id: input.contractorId,
      payout_amount: input.payoutAmount ?? 0,
      payout_status: 'pending',
      updated_at: now,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Не вдалося створити заявку: ${error.message}`);
  }

  if (!application?.id) {
    throw new Error('Заявку створено без ID.');
  }

  await notifyAssignedApplication(application.id);
}

export async function assignApplicationContractor(
  applicationId: string,
  contractorId: string,
): Promise<void> {
  if (!applicationId) {
    throw new Error('ID заявки відсутній.');
  }

  if (!contractorId) {
    throw new Error('Оберіть підрядника.');
  }

  await verifyContractor(contractorId);

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

  if (updateError) {
    throw new Error(`Не вдалося призначити підрядника: ${updateError.message}`);
  }

  await notifyAssignedApplication(applicationId);
}



export type DeleteSelectedApplicationsResult = {
  total: number;
  deleted: number;
  failed: number;
  failedIds: string[];
};

export async function deleteSelectedApplications(
  applicationIds: string[],
): Promise<DeleteSelectedApplicationsResult> {
  const ids = [...new Set(
    applicationIds
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  )];

  if (ids.length === 0) {
    return {
      total: 0,
      deleted: 0,
      failed: 0,
      failedIds: [],
    };
  }

  const { data, error } = await supabase.functions.invoke('smart-api', {
    body: {
      action: 'delete_applications_bulk_from_web',
      application_ids: ids,
    },
  });

  if (error) {
    throw new Error(`Не вдалося видалити заявки: ${error.message}`);
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Не вдалося видалити вибрані заявки.');
  }

  return {
    total: Number(data.total ?? ids.length),
    deleted: Number(data.deleted ?? 0),
    failed: Number(data.failed ?? 0),
    failedIds: Array.isArray(data.failed_ids) ? data.failed_ids : [],
  };
}

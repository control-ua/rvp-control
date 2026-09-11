import { supabase } from '@/lib/supabase';

export type ActStatus = 'approved' | 'pending' | 'rejected';

export interface ActFile {
  id: string;
  actId: string;
  telegramFileId: string;
  fileType: string;
  fileName: string | null;
  createdAt: string;
  url: string;
}

export function telegramFileUrl(telegramFileId: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  return `${base}/functions/v1/telegram-file?file_id=${encodeURIComponent(telegramFileId)}`;
}

export interface ActItem {
  id: string;
  actNumber: string | null;
  actDate: string | null;
  status: ActStatus;
  createdAt: string;
  reviewedAt: string | null;
  contractorId: string | null;
  contractorName: string;
  contractorPhone: string | null;
  applicationId: string | null;
  applicationNumber: string;
  applicationTitle: string;
  applicationAddress: string | null;
  applicationDescription: string | null;
  applicationAzkCode: string | null;
  files: ActFile[];
}

interface ActRow {
  id: string;
  contractor_id: string | null;
  application_id: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  act_number: string | null;
  act_date: string | null;
}

interface ContractorRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface ApplicationRow {
  id: string;
  application_number: string | null;
  title: string;
  address: string | null;
  description: string | null;
  azk_code: string | null;
}

interface ActFileRow {
  id: string;
  act_id: string;
  telegram_file_id: string;
  file_type: string;
  file_name: string | null;
  created_at: string;
}

const ACT_SELECT = `
  id,
  contractor_id,
  application_id,
  status,
  created_at,
  reviewed_at,
  act_number,
  act_date
`;

function buildContractorName(c: ContractorRow | null): string {
  if (!c) return '—';
  const parts = [c.first_name, c.last_name].filter(p => p && p.trim());
  return parts.join(' ') || '—';
}

/**
 * IMPORTANT:
 * We no longer update an act directly from the web UI for approved/rejected.
 * Instead we call the Telegram Edge Function so the exact same bot logic runs:
 * - act status is changed
 * - application is completed / updated
 * - work history is written
 * - Telegram group card is updated
 * - contractor gets a notification
 */
export async function updateActStatus(
  actId: string,
  status: ActStatus,
): Promise<void> {
  if (!actId) {
    throw new Error('ID акта відсутній.');
  }

  if (status === 'pending') {
    const { error } = await supabase
      .from('acts')
      .update({
        status: 'pending',
        reviewed_at: null,
      })
      .eq('id', actId);

    if (error) {
      throw new Error(`Не вдалося оновити статус акта: ${error.message}`);
    }

    return;
  }

  const action =
    status === 'approved'
      ? 'approve_act_from_web'
      : 'reject_act_from_web';

  const {
    data: result,
    error: invokeError,
  } = await supabase.functions.invoke('smart-api', {
    body: {
      action,
      act_id: actId,
    },
  });

  if (invokeError) {
    throw new Error(
      `Не вдалося передати дію в Telegram-бот: ${invokeError.message}`,
    );
  }

  if (result?.ok === false) {
    throw new Error(
      result?.error ||
      'Telegram-бот не зміг обробити акт.',
    );
  }
}

export async function fetchActs(): Promise<ActItem[]> {
  const { data: actRows, error: actError } = await supabase
    .from('acts')
    .select(ACT_SELECT)
    .order('created_at', { ascending: false });

  if (actError) {
    throw new Error(`Не вдалося завантажити акти: ${actError.message}`);
  }

  if (!actRows || actRows.length === 0) {
    return [];
  }

  const acts = actRows as unknown as ActRow[];

  const contractorIds = [
    ...new Set(
      acts
        .map(a => a.contractor_id)
        .filter(Boolean),
    ),
  ] as string[];

  const applicationIds = [
    ...new Set(
      acts
        .map(a => a.application_id)
        .filter(Boolean),
    ),
  ] as string[];

  const [
    contractorsResult,
    applicationsResult,
    filesResult,
  ] = await Promise.all([
    contractorIds.length > 0
      ? supabase
          .from('contractors')
          .select('id, first_name, last_name, phone')
          .in('id', contractorIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    applicationIds.length > 0
      ? supabase
          .from('applications')
          .select(
            'id, application_number, title, address, description, azk_code',
          )
          .in('id', applicationIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    supabase
      .from('act_files')
      .select(
        'id, act_id, telegram_file_id, file_type, file_name, created_at',
      )
      .order('created_at', {
        ascending: true,
      }),
  ]);

  if (contractorsResult.error) {
    throw new Error(
      `Не вдалося завантажити підрядників: ${contractorsResult.error.message}`,
    );
  }

  if (applicationsResult.error) {
    throw new Error(
      `Не вдалося завантажити заявки: ${applicationsResult.error.message}`,
    );
  }

  if (filesResult.error) {
    throw new Error(
      `Не вдалося завантажити файли: ${filesResult.error.message}`,
    );
  }

  const contractorMap = new Map<string, ContractorRow>();

  for (
    const c of
      (contractorsResult.data ?? []) as unknown as ContractorRow[]
  ) {
    contractorMap.set(c.id, c);
  }

  const applicationMap = new Map<string, ApplicationRow>();

  for (
    const a of
      (applicationsResult.data ?? []) as unknown as ApplicationRow[]
  ) {
    applicationMap.set(a.id, a);
  }

  const filesByAct = new Map<string, ActFile[]>();

  for (
    const f of
      (filesResult.data ?? []) as unknown as ActFileRow[]
  ) {
    const list =
      filesByAct.get(f.act_id) ?? [];

    list.push({
      id: f.id,
      actId: f.act_id,
      telegramFileId: f.telegram_file_id,
      fileType: f.file_type,
      fileName: f.file_name,
      createdAt: f.created_at,
      url: telegramFileUrl(f.telegram_file_id),
    });

    filesByAct.set(
      f.act_id,
      list,
    );
  }

  return acts.map(row => {
    const contractor =
      row.contractor_id
        ? contractorMap.get(
            row.contractor_id,
          )
        : null;

    const application =
      row.application_id
        ? applicationMap.get(
            row.application_id,
          )
        : null;

    return {
      id: row.id,
      actNumber:
        row.act_number,

      actDate:
        row.act_date,

      status:
        (row.status as ActStatus) ??
        'pending',

      createdAt:
        row.created_at,

      reviewedAt:
        row.reviewed_at,

      contractorId:
        row.contractor_id,

      contractorName:
        buildContractorName(
          contractor ?? null,
        ),

      contractorPhone:
        contractor?.phone ??
        null,

      applicationId:
        row.application_id,

      applicationNumber:
        application?.application_number ??
        '—',

      applicationTitle:
        application?.title ??
        '—',

      applicationAddress:
        application?.address ??
        null,

      applicationDescription:
        application?.description ??
        null,

      applicationAzkCode:
        application?.azk_code ??
        null,

      files:
        filesByAct.get(
          row.id,
        ) ?? [],
    };
  });
}

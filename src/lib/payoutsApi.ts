import { supabase } from '@/lib/supabase';
import { normalizePayoutStatus, normalizeStatus } from '@/utils/helpers';
import { telegramFileUrl } from '@/lib/actsApi';
import type { PayoutStatus, ApplicationStatus } from '@/types';

export interface PayoutItem {
  id: string;
  applicationNumber: string;
  contractorName: string;
  contractorPhone: string | null;
  amount: number;
  payoutStatus: PayoutStatus;
  paidAt: string | null;
  receiptFileId: string | null;
  receiptType: string | null;
  receiptName: string | null;
  receiptUrl: string | null;
  applicationTitle: string;
  applicationAddress: string | null;
}

interface PayoutRow {
  id: string;
  application_number: string | null;
  title: string;
  address: string | null;
  payout_amount: number;
  payout_status: string;
  paid_at: string | null;
  payout_receipt_file_id: string | null;
  payout_receipt_type: string | null;
  payout_receipt_name: string | null;
  contractor_id: string | null;
  contractor: { first_name: string | null; last_name: string | null; phone: string | null } | null;
}

const PAYOUT_SELECT = `
  id,
  application_number,
  title,
  address,
  payout_amount,
  payout_status,
  paid_at,
  payout_receipt_file_id,
  payout_receipt_type,
  payout_receipt_name,
  contractor_id,
  contractor:contractors ( first_name, last_name, phone )
`;

function buildName(c: { first_name: string | null; last_name: string | null } | null): string {
  if (!c) return '—';
  const parts = [c.first_name, c.last_name].filter(p => p && p.trim());
  return parts.join(' ') || '—';
}

export async function fetchPayouts(): Promise<PayoutItem[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(PAYOUT_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Не вдалося завантажити виплати: ${error.message}`);
  }

  if (!data || data.length === 0) return [];

  return (data as unknown as PayoutRow[]).map(row => ({
    id: row.id,
    applicationNumber: row.application_number ?? '—',
    contractorName: buildName(row.contractor),
    contractorPhone: row.contractor?.phone ?? null,
    amount: Number(row.payout_amount) ?? 0,
    payoutStatus: normalizePayoutStatus(row.payout_status),
    paidAt: row.paid_at,
    receiptFileId: row.payout_receipt_file_id,
    receiptType: row.payout_receipt_type,
    receiptName: row.payout_receipt_name,
    receiptUrl: row.payout_receipt_file_id ? telegramFileUrl(row.payout_receipt_file_id) : null,
    applicationTitle: row.title,
    applicationAddress: row.address ?? null,
  }));
}

export async function confirmPayout(
  applicationId: string,
  receiptName?: string,
): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .update({
      payout_status: 'paid',
      paid_at: new Date().toISOString(),
      payout_receipt_name: receiptName ?? null,
    })
    .eq('id', applicationId);

  if (error) {
    throw new Error(`Не вдалося підтвердити виплату: ${error.message}`);
  }
}

import { supabase } from '@/lib/supabase';
import { normalizeStatus } from '@/utils/helpers';
import type { ActivityFeedItem } from '@/types';

interface FeedRow {
  id: string;
  application_number: string | null;
  title: string;
  address: string | null;
  status: string;
  contractor_stage: string | null;
  has_problem: boolean | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  departed_at: string | null;
  paid_at: string | null;
  payout_status: string | null;
  contractor_id: string | null;
  contractor: { first_name: string | null; last_name: string | null } | null;
}

function buildName(c: { first_name: string | null; last_name: string | null } | null): string {
  if (!c) return '—';
  const parts = [c.first_name, c.last_name].filter(p => p && p.trim());
  return parts.join(' ') || '—';
}

export async function fetchActivityFeed(limit = 10): Promise<ActivityFeedItem[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, application_number, title, address, status, contractor_stage, has_problem,
      created_at, updated_at, accepted_at, departed_at, paid_at, payout_status,
      contractor_id, contractor:contractors ( first_name, last_name )
    `)
    .order('updated_at', { ascending: false })
    .limit(limit * 3);

  if (error) throw new Error(`Не вдалося завантажити стрічку: ${error.message}`);

  const rows = (data ?? []) as unknown as FeedRow[];
  const items: ActivityFeedItem[] = [];

  for (const row of rows) {
    const contractorName = buildName(row.contractor);
    const num = row.application_number ?? '—';
    const ns = normalizeStatus(row.status);

    if (row.has_problem) {
      items.push({
        id: `${row.id}-problem`,
        type: 'problem',
        title: 'Виникла проблема',
        description: row.title ?? '',
        applicationNumber: num,
        contractorName,
        createdAt: row.updated_at,
        severity: 'warning',
      });
    }

    if (row.payout_status === 'paid' && row.paid_at) {
      items.push({
        id: `${row.id}-payout-paid`,
        type: 'payout_paid',
        title: 'Виплату проведено',
        description: `${num} • ${contractorName}`,
        applicationNumber: num,
        contractorName,
        createdAt: row.paid_at,
        severity: 'info',
      });
    } else if (row.payout_status === 'pending' && ns === 'Виконана') {
      items.push({
        id: `${row.id}-payout-created`,
        type: 'payout_created',
        title: 'Створено виплату',
        description: `${num} • ${contractorName}`,
        applicationNumber: num,
        contractorName,
        createdAt: row.updated_at,
        severity: 'info',
      });
    }

    if (ns === 'Виконана') {
      items.push({
        id: `${row.id}-completed`,
        type: 'application_completed',
        title: 'Заявку виконано',
        description: `${num} • ${row.title ?? ''}`,
        applicationNumber: num,
        contractorName,
        createdAt: row.updated_at,
        severity: 'info',
      });
    }

    if (row.contractor_stage === 'departed' && row.departed_at) {
      items.push({
        id: `${row.id}-departed`,
        type: 'contractor_departed',
        title: 'Підрядник виїхав',
        description: `${num} • ${contractorName}`,
        applicationNumber: num,
        contractorName,
        createdAt: row.departed_at,
        severity: 'info',
      });
    }

    if (row.contractor_stage === 'in_progress' && row.accepted_at) {
      items.push({
        id: `${row.id}-started`,
        type: 'work_started',
        title: 'Роботу розпочато',
        description: `${num} • ${contractorName}`,
        applicationNumber: num,
        contractorName,
        createdAt: row.accepted_at,
        severity: 'info',
      });
    }

    if (row.contractor_id && row.accepted_at) {
      items.push({
        id: `${row.id}-assigned`,
        type: 'contractor_assigned',
        title: 'Призначено підрядника',
        description: `${num} • ${contractorName}`,
        applicationNumber: num,
        contractorName,
        createdAt: row.accepted_at,
        severity: 'info',
      });
    }

    items.push({
      id: `${row.id}-created`,
      type: 'application_created',
      title: 'Створено заявку',
      description: `${num} • ${row.title ?? ''}`,
      applicationNumber: num,
      contractorName: '—',
      createdAt: row.created_at,
      severity: 'info',
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, limit);
}

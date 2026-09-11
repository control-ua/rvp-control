import { supabase } from '@/lib/supabase';
import { normalizeStatus } from '@/utils/helpers';
import type { ControlCenterItem } from '@/types';

interface AppRow {
  id: string;
  application_number: string | null;
  title: string;
  address: string | null;
  status: string;
  contractor_id: string | null;
  contractor_stage: string | null;
  has_problem: boolean | null;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchControlCenter(): Promise<ControlCenterItem[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id, application_number, title, address, status, contractor_id,
      contractor_stage, has_problem, deadline_at, created_at, updated_at
    `)
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) throw new Error(`Не вдалося завантажити центр контролю: ${error.message}`);

  const rows = (data ?? []) as unknown as AppRow[];
  const items: ControlCenterItem[] = [];
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  for (const row of rows) {
    const num = row.application_number ?? '—';
    const ns = normalizeStatus(row.status);

    if (ns === 'Скасована' || ns === 'Виконана') continue;

    if (row.deadline_at) {
      const deadline = new Date(row.deadline_at);
      if (deadline < now) {
        items.push({
          id: `${row.id}-overdue`,
          type: 'overdue',
          title: `Прострочено — ${num}`,
          description: row.title ?? '',
          applicationId: row.id,
          applicationNumber: num,
          severity: 'critical',
          createdAt: row.deadline_at,
        });
      } else if (deadline <= todayEnd) {
        items.push({
          id: `${row.id}-deadline-today`,
          type: 'deadline_today',
          title: `Дедлайн сьогодні — ${num}`,
          description: row.title ?? '',
          applicationId: row.id,
          applicationNumber: num,
          severity: 'warning',
          createdAt: row.deadline_at,
        });
      }
    }

    if (!row.contractor_id) {
      const created = new Date(row.created_at);
      const minutesAgo = (now.getTime() - created.getTime()) / 60000;
      items.push({
        id: `${row.id}-no-contractor`,
        type: 'no_contractor',
        title: `Без підрядника — ${num}`,
        description: `${row.title ?? ''}${minutesAgo > 15 ? ' • понад 15 хв' : ''}`,
        applicationId: row.id,
        applicationNumber: num,
        severity: minutesAgo > 15 ? 'critical' : 'warning',
        createdAt: row.created_at,
      });
    }

    if (row.has_problem || row.contractor_stage === 'problem') {
      items.push({
        id: `${row.id}-problem`,
        type: 'problem',
        title: `Проблема — ${num}`,
        description: row.title ?? '',
        applicationId: row.id,
        applicationNumber: num,
        severity: 'critical',
        createdAt: row.updated_at,
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
    for (const act of actData as unknown as { id: string; application_id: string | null; created_at: string }[]) {
      const ageHours = (now.getTime() - new Date(act.created_at).getTime()) / 3600000;
      items.push({
        id: `${act.id}-act-pending`,
        type: 'act_pending',
        title: 'Акт на перевірці',
        description: ageHours > 24 ? 'Очікує понад 24 год' : 'Очікує перевірки',
        applicationId: act.application_id ?? '',
        applicationNumber: '—',
        severity: ageHours > 24 ? 'warning' : 'info',
        createdAt: act.created_at,
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
    for (const pay of payData as unknown as { id: string; application_number: string | null; title: string; payout_amount: string | number; updated_at: string }[]) {
      items.push({
        id: `${pay.id}-payout-pending`,
        type: 'payout_pending',
        title: `Очікує виплату — ${pay.application_number ?? '—'}`,
        description: `${pay.title ?? ''} • ${Number(pay.payout_amount || 0).toLocaleString('uk-UA')} ₴`,
        applicationId: pay.id,
        applicationNumber: pay.application_number ?? '—',
        severity: 'warning',
        createdAt: pay.updated_at,
      });
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  items.sort((a, b) => {
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return items;
}

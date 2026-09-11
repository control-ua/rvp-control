import { supabase } from '@/lib/supabase';
import type { FinanceStats, FinanceDailyPoint, FinanceTopContractor } from '@/types';

interface AppRow {
  id: string;
  payout_amount: number;
  payout_status: string;
  paid_at: string | null;
  created_at: string;
  contractor_id: string | null;
  contractor: { first_name: string | null; last_name: string | null } | null;
}

function buildName(c: { first_name: string | null; last_name: string | null } | null): string {
  if (!c) return '—';
  const parts = [c.first_name, c.last_name].filter(p => p && p.trim());
  return parts.join(' ') || '—';
}

export async function fetchFinanceStats(): Promise<FinanceStats> {
  const { data, error } = await supabase
    .from('applications')
    .select('id, payout_amount, payout_status, paid_at, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`Не вдалося завантажити фінанси: ${error.message}`);

  const rows = (data ?? []) as unknown as AppRow[];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let accruedToday = 0, accruedThisMonth = 0, paidThisMonth = 0, pendingPayout = 0, totalDebt = 0;

  for (const row of rows) {
    const amount = Number(row.payout_amount) || 0;
    const created = new Date(row.created_at);
    if (created >= todayStart) accruedToday += amount;
    if (created >= monthStart) accruedThisMonth += amount;

    if (row.payout_status === 'paid') {
      if (row.paid_at && new Date(row.paid_at) >= monthStart) paidThisMonth += amount;
    } else {
      pendingPayout += amount;
      totalDebt += amount;
    }
  }

  return { accruedToday, accruedThisMonth, paidThisMonth, pendingPayout, totalDebt };
}

export async function fetchFinanceDaily(days = 30): Promise<FinanceDailyPoint[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);

  const { data, error } = await supabase
    .from('applications')
    .select('payout_amount, payout_status, paid_at')
    .gte('paid_at', start.toISOString())
    .order('paid_at', { ascending: true });

  if (error) return [];

  const rows = (data ?? []) as unknown as { payout_amount: number; payout_status: string; paid_at: string }[];
  const byDate = new Map<string, number>();

  for (const row of rows) {
    if (row.payout_status !== 'paid' || !row.paid_at) continue;
    const d = new Date(row.paid_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDate.set(key, (byDate.get(key) ?? 0) + (Number(row.payout_amount) || 0));
  }

  const points: FinanceDailyPoint[] = [];
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    points.push({ date: key, amount: byDate.get(key) ?? 0 });
  }

  return points;
}

export async function fetchFinanceTopContractors(): Promise<FinanceTopContractor[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(`
      payout_amount, payout_status,
      contractor_id, contractor:contractors ( first_name, last_name )
    `)
    .eq('payout_status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(500);

  if (error) return [];

  const rows = (data ?? []) as unknown as AppRow[];
  const byContractor = new Map<string, { name: string; total: number; count: number }>();

  for (const row of rows) {
    if (!row.contractor_id) continue;
    const existing = byContractor.get(row.contractor_id) ?? { name: buildName(row.contractor), total: 0, count: 0 };
    existing.total += Number(row.payout_amount) || 0;
    existing.count += 1;
    byContractor.set(row.contractor_id, existing);
  }

  return Array.from(byContractor.entries())
    .map(([id, v]) => ({ id, name: v.name, totalPayout: v.total, payoutCount: v.count }))
    .sort((a, b) => b.totalPayout - a.totalPayout)
    .slice(0, 10);
}

import { supabase } from '@/lib/supabase';
import type { ContractorRatingItem } from '@/types';

interface AppRow {
  contractor_id: string | null;
  status: string;
  contractor_stage: string | null;
  has_problem: boolean | null;
  payout_amount: string | number;
  payout_status: string;
  created_at: string;
  accepted_at: string | null;
}

interface ContractorRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

function buildName(c: ContractorRow): string {
  const parts = [c.first_name, c.last_name].filter(p => p && p.trim());
  return parts.join(' ') || '—';
}

export async function fetchContractorRating(period: 'all' | 'month' | '30d' = 'all'): Promise<ContractorRatingItem[]> {
  let query = supabase.from('applications').select(`
    contractor_id, status, contractor_stage, has_problem,
    payout_amount, payout_status, created_at, accepted_at
  `);

  if (period === 'month') {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    query = query.gte('created_at', start.toISOString());
  } else if (period === '30d') {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    query = query.gte('created_at', start.toISOString());
  }

  const [appResult, contractorResult] = await Promise.all([
    query,
    supabase.from('contractors').select('id, first_name, last_name, phone'),
  ]);

  if (appResult.error) throw new Error(`Не вдалося завантажити рейтинг: ${appResult.error.message}`);

  const apps = (appResult.data ?? []) as unknown as AppRow[];
  const contractors = (contractorResult.data ?? []) as unknown as ContractorRow[];

  const stats = new Map<string, {
    active: number; total: number; completed: number; problem: number;
    payout: number; completionTimes: number[];
  }>();

  for (const row of apps) {
    if (!row.contractor_id) continue;
    const s = stats.get(row.contractor_id) ?? { active: 0, total: 0, completed: 0, problem: 0, payout: 0, completionTimes: [] };
    s.total += 1;

    if (row.status === 'completed') {
      s.completed += 1;
      if (row.accepted_at && row.created_at) {
        const hours = (new Date(row.created_at).getTime() - new Date(row.accepted_at).getTime()) / 3600000;
        if (hours >= 0 && hours < 720) s.completionTimes.push(hours);
      }
    } else if (row.status !== 'cancelled') {
      s.active += 1;
    }

    if (row.has_problem || row.contractor_stage === 'problem') s.problem += 1;
    if (row.payout_status === 'paid') s.payout += Number(row.payout_amount) || 0;

    stats.set(row.contractor_id, s);
  }

  const items: ContractorRatingItem[] = contractors.map(c => {
    const s = stats.get(c.id);
    const completionRate = s && s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    const avgCompletionHours = s && s.completionTimes.length > 0
      ? Math.round(s.completionTimes.reduce((a, b) => a + b, 0) / s.completionTimes.length)
      : null;

    return {
      id: c.id,
      name: buildName(c),
      phone: c.phone ?? null,
      activeApplications: s?.active ?? 0,
      totalApplications: s?.total ?? 0,
      completedApplications: s?.completed ?? 0,
      problemApplications: s?.problem ?? 0,
      completionRate,
      totalPayout: s?.payout ?? 0,
      avgCompletionHours,
      rank: 0,
    };
  });

  items.sort((a, b) => {
    if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
    if (b.completedApplications !== a.completedApplications) return b.completedApplications - a.completedApplications;
    return b.totalPayout - a.totalPayout;
  });

  items.forEach((item, i) => { item.rank = i + 1; });

  return items;
}

import { supabase } from '@/lib/supabase';
import type { SearchResult } from '@/types';

export async function globalSearch(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const [appResult, contractorResult, actResult] = await Promise.all([
    supabase
      .from('applications')
      .select('id, application_number, title, address, azk_code, status')
      .or(`application_number.ilike.%${q}%,title.ilike.%${q}%,address.ilike.%${q}%,azk_code.ilike.%${q}%`)
      .limit(10),
    supabase
      .from('contractors')
      .select('id, first_name, last_name, phone, username')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,username.ilike.%${q}%`)
      .limit(5),
    supabase
      .from('acts')
      .select('id, act_number, application_id')
      .or(`act_number.ilike.%${q}%`)
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  for (const row of (appResult.data ?? []) as unknown as { id: string; application_number: string | null; title: string; address: string | null; azk_code: string | null; status: string }[]) {
    results.push({
      id: row.id,
      type: 'application',
      title: row.title ?? '—',
      subtitle: `${row.application_number ?? '—'} • ${row.address ?? ''} • ${row.azk_code ?? ''}`,
      number: row.application_number ?? '—',
    });
  }

  for (const row of (contractorResult.data ?? []) as unknown as { id: string; first_name: string | null; last_name: string | null; phone: string | null; username: string | null }[]) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ') || '—';
    results.push({
      id: row.id,
      type: 'contractor',
      title: name,
      subtitle: `${row.phone ?? '—'} • @${row.username ?? '—'}`,
      number: row.phone ?? '',
    });
  }

  for (const row of (actResult.data ?? []) as unknown as { id: string; act_number: string | null; application_id: string | null }[]) {
    results.push({
      id: row.id,
      type: 'act',
      title: `Акт ${row.act_number ?? '—'}`,
      subtitle: `Акт ${row.act_number ?? '—'}`,
      number: row.act_number ?? '—',
    });
  }

  return results;
}

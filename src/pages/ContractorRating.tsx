import { useCallback, useEffect, useState } from 'react';
import { Trophy, RefreshCw, Loader2, TrendingUp, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { fetchContractorRating } from '@/lib/ratingApi';
import { formatCurrency } from '@/utils/helpers';
import type { ContractorRatingItem } from '@/types';

type Period = 'all' | 'month' | '30d';

const periodLabels: Record<Period, string> = {
  all: 'За весь час',
  month: 'Місяць',
  '30d': '30 днів',
};

export default function ContractorRating() {
  const [items, setItems] = useState<ContractorRatingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchContractorRating(period);
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageHeader
      pageTitle="Рейтинг підрядників"
      pageSubtitle="Ефективність та результати"
      actions={
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={e => setPeriod(e.target.value as Period)}
            className="rounded-lg border border-white/10 bg-[#0f1219] px-3 py-2 text-sm text-slate-300 outline-none"
          >
            {Object.entries(periodLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Оновити
          </button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#141821]">
        {loading ? (
          <div className="py-14 text-center"><Loader2 size={20} className="mx-auto animate-spin text-slate-500" /></div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center"><Trophy size={24} className="mx-auto text-slate-600" /><p className="mt-3 text-sm text-slate-400">Немає даних</p></div>
        ) : (
          <div className="overflow-x-auto mobile-no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">ПІБ</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Активні</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Всього</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Виконані</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Проблеми</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">% виконання</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Виплати</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Сер. час</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${item.rank <= 3 ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-slate-400'}`}>
                        {item.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-200">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.phone ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-300">{item.activeApplications}</td>
                    <td className="px-4 py-3 text-center text-slate-300">{item.totalApplications}</td>
                    <td className="px-4 py-3 text-center text-emerald-400">{item.completedApplications}</td>
                    <td className="px-4 py-3 text-center">
                      {item.problemApplications > 0 ? <span className="text-red-400">{item.problemApplications}</span> : <span className="text-slate-600">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-medium ${item.completionRate >= 80 ? 'text-emerald-400' : item.completionRate >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {item.completionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(item.totalPayout)}</td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {item.avgCompletionHours !== null ? `${item.avgCompletionHours} год` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageHeader>
  );
}

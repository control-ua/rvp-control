import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportApplications, exportContractors, exportPayouts, exportActs, exportProblems } from '@/lib/exportApi';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';

export default function ExportPanel() {
  const { showToast } = useApp();
  const [loading, setLoading] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [contractorId, setContractorId] = useState('');

  const [contractors, setContractors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('contractors').select('id, first_name, last_name').order('first_name', { ascending: true });
        setContractors((data ?? []).map((c: any) => ({
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || '—',
        })));
      } catch { /* ignore */ }
    })();
  }, []);

  const handleExport = async (type: string) => {
    setLoading(type);
    try {
      const filters = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, status: status || undefined, contractorId: contractorId || undefined };
      switch (type) {
        case 'applications': await exportApplications(filters); break;
        case 'contractors': await exportContractors(); break;
        case 'payouts': await exportPayouts(); break;
        case 'acts': await exportActs(); break;
        case 'problems': await exportProblems(); break;
      }
      showToast('Експорт завершено', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Помилка експорту', 'error');
    } finally {
      setLoading(null);
    }
  };

  const buttons = [
    { type: 'applications', label: 'Заявки' },
    { type: 'contractors', label: 'Підрядники' },
    { type: 'payouts', label: 'Виплати' },
    { type: 'acts', label: 'Акти' },
    { type: 'problems', label: 'Проблемні' },
  ];

  return (
    <div className="rounded-2xl border border-white/5 bg-[#141821] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <Download size={16} className="text-blue-400" /> Експорт звітів (CSV)
      </h3>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Дата від</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Дата до</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Статус</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none">
            <option value="">Всі</option>
            <option value="new">Нові</option>
            <option value="assigned">Прийняті</option>
            <option value="in_progress">В роботі</option>
            <option value="completed">Виконані</option>
            <option value="cancelled">Скасовані</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Підрядник</label>
          <select value={contractorId} onChange={e => setContractorId(e.target.value)} className="w-full rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-slate-200 outline-none">
            <option value="">Всі</option>
            {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {buttons.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => handleExport(type)}
            disabled={loading !== null}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50"
          >
            {loading === type ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MapPin, RefreshCw, User } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

type ProblemRow = {
  id: string;
  application_number: string | null;
  title: string | null;
  description: string | null;
  address: string | null;
  deadline_at: string | null;
  manager_comment: string | null;
  contractor_stage: string | null;
  updated_at: string | null;
  contractor: { first_name: string | null; last_name: string | null; phone: string | null } | null;
};

export default function Problems() {
  const { showToast } = useApp();
  const [items, setItems] = useState<ProblemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('applications')
      .select(`
        id, application_number, title, description, address, deadline_at,
        manager_comment, contractor_stage, updated_at,
        contractor:contractors(first_name,last_name,phone)
      `)
      .eq('contractor_stage', 'problem')
      .order('updated_at', { ascending: false });

    if (error) showToast(`Не вдалося завантажити проблеми: ${error.message}`, 'error');
    setItems((data ?? []) as unknown as ProblemRow[]);
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('problem-applications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const resolve = async (id: string) => {
    setResolving(id);
    const { error } = await supabase
      .from('applications')
      .update({ contractor_stage: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) showToast(`Не вдалося закрити проблему: ${error.message}`, 'error');
    else {
      showToast('Проблему позначено як вирішену', 'success');
      await load();
    }
    setResolving(null);
  };

  return (
    <PageHeader pageTitle="Проблемні заявки" pageSubtitle={`${items.length} активних проблем`}
      actions={<button onClick={load} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><RefreshCw size={14}/>Оновити</button>}>
      {loading ? (
        <div className="flex justify-center py-20 text-slate-500"><Loader2 className="animate-spin" size={18}/></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.04] py-20 text-center">
          <CheckCircle2 size={30} className="mx-auto text-emerald-400"/>
          <p className="mt-4 text-sm font-medium text-slate-200">Активних проблем немає</p>
          <p className="mt-1 text-xs text-slate-500">Заявки зі статусом problem автоматично зʼявляться тут.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map(item => {
            const contractorName = [item.contractor?.first_name, item.contractor?.last_name].filter(Boolean).join(' ') || '—';
            return (
              <div key={item.id} className="rounded-2xl border border-red-500/10 bg-[#141821] p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                    <AlertTriangle size={19}/>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-red-400">{item.application_number || '—'}</span>
                      <span className="rounded-full bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400">ПРОБЛЕМА</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-white">{item.title || 'Заявка'}</h3>
                    {item.description && <p className="mt-1 text-sm text-slate-400">{item.description}</p>}
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5"><MapPin size={13}/>{item.address || '—'}</span>
                      <span className="flex items-center gap-1.5"><User size={13}/>{contractorName} · {item.contractor?.phone || '—'}</span>
                    </div>
                    {item.manager_comment && <div className="mt-4 rounded-xl bg-white/[0.025] p-3 text-sm text-slate-400">{item.manager_comment}</div>}
                  </div>
                  <button disabled={resolving === item.id} onClick={() => resolve(item.id)}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                    {resolving === item.id ? <Loader2 size={15} className="animate-spin"/> : <CheckCircle2 size={15}/>}
                    Вирішено
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageHeader>
  );
}

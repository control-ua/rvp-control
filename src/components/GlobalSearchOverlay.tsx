import { useEffect, useRef, useState } from 'react';
import { Search, FileText, Users, ClipboardList, X, Loader2 } from 'lucide-react';
import { globalSearch } from '@/lib/searchApi';
import type { SearchResult } from '@/types';

interface Props {
  onClose: () => void;
  onNavigate: (page: 'applications' | 'contractors' | 'acts', id?: string) => void;
}

export default function GlobalSearchOverlay({ onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (query.trim().length < 2) { setResults([]); return; }

    setLoading(true);
    timerRef.current = window.setTimeout(async () => {
      try {
        const r = await globalSearch(query);
        setResults(r);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);

    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [query]);

  const handleClick = (r: SearchResult) => {
    const page = r.type === 'application' ? 'applications' : r.type === 'contractor' ? 'contractors' : 'acts';
    onNavigate(page, r.id);
    onClose();
  };

  const apps = results.filter(r => r.type === 'application');
  const contractors = results.filter(r => r.type === 'contractor');
  const acts = results.filter(r => r.type === 'act');

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-[#141821] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <Search size={18} className="text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Пошук: заявки, підрядники, акти..."
            className="flex-1 bg-transparent text-sm text-slate-200 outline-none"
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          />
          {loading && <Loader2 size={16} className="animate-spin text-slate-500" />}
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <div className="py-12 text-center">
              <Search size={28} className="mx-auto text-slate-600" />
              <p className="mt-3 text-sm text-slate-500">Введіть мінімум 2 символи для пошуку</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="py-12 text-center">
              <p className="text-sm text-slate-500">Нічого не знайдено</p>
            </div>
          ) : (
            <>
              {apps.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-600">Заявки</p>
                  {apps.map(r => (
                    <button key={r.id} onClick={() => handleClick(r)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/5">
                      <FileText size={16} className="text-blue-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{r.title}</p>
                        <p className="text-xs text-slate-500">{r.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {contractors.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-600">Підрядники</p>
                  {contractors.map(r => (
                    <button key={r.id} onClick={() => handleClick(r)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/5">
                      <Users size={16} className="text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{r.title}</p>
                        <p className="text-xs text-slate-500">{r.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {acts.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-600">Акти</p>
                  {acts.map(r => (
                    <button key={r.id} onClick={() => handleClick(r)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/5">
                      <ClipboardList size={16} className="text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{r.title}</p>
                        <p className="text-xs text-slate-500">{r.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

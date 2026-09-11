import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  UserX,
  ShieldAlert,
  ClipboardCheck,
  Wallet,
  RefreshCw,
  Loader2,
  Search,
  ChevronRight,
  Activity,
  CheckCircle2,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { fetchControlCenter } from '@/lib/controlCenterApi';
import type { ControlCenterItem } from '@/types';

interface Props {
  onNavigateToApplication?: () => void;
}

type FilterType =
  | 'all'
  | 'overdue'
  | 'no_contractor'
  | 'problem'
  | 'act_pending'
  | 'payout_pending';

const severityStyles: Record<string, string> = {
  critical: 'border-red-500/30 bg-red-500/[0.06] text-red-400',
  warning: 'border-amber-500/30 bg-amber-500/[0.06] text-amber-400',
  info: 'border-blue-500/30 bg-blue-500/[0.06] text-blue-400',
};

const typeIcons: Record<string, typeof AlertTriangle> = {
  overdue: Clock,
  no_contractor: UserX,
  problem: ShieldAlert,
  deadline_today: Clock,
  act_pending: ClipboardCheck,
  payout_pending: Wallet,
};

const severityLabels: Record<string, string> = {
  critical: 'КРИТИЧНО',
  warning: 'УВАГА',
  info: 'ІНФОРМАЦІЯ',
};

const typeLabels: Record<string, string> = {
  overdue: 'Прострочено',
  no_contractor: 'Без підрядника',
  problem: 'Проблема',
  deadline_today: 'Дедлайн сьогодні',
  act_pending: 'Очікує акт',
  payout_pending: 'Очікує виплату',
};

export default function ControlCenter({ onNavigateToApplication }: Props) {
  const [items, setItems] = useState<ControlCenterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchControlCenter();
      setItems(data);
    } catch (e) {
      console.error('ControlCenter load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      overdue: items.filter(i => i.type === 'overdue').length,
      no_contractor: items.filter(i => i.type === 'no_contractor').length,
      problem: items.filter(i => i.type === 'problem').length,
      act_pending: items.filter(i => i.type === 'act_pending').length,
      payout_pending: items.filter(i => i.type === 'payout_pending').length,
    }),
    [items],
  );

  const criticalCount = useMemo(
    () => items.filter(i => i.severity === 'critical').length,
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter(item => {
      if (filter !== 'all' && item.type !== filter) return false;

      if (!q) return true;

      return [
        item.title,
        item.description,
        item.type,
        item.severity,
        item.applicationId ? String(item.applicationId) : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, filter]);

  const openApplication = (item: ControlCenterItem) => {
    if (item.applicationId) {
      sessionStorage.setItem(
        'rvp-open-application-id',
        String(item.applicationId),
      );
    }

    onNavigateToApplication?.();
  };

  const statCards = [
    {
      key: 'overdue' as FilterType,
      label: 'Прострочено',
      value: counts.overdue,
      icon: Clock,
      color: 'text-red-400 bg-red-500/10',
    },
    {
      key: 'no_contractor' as FilterType,
      label: 'Без підрядника',
      value: counts.no_contractor,
      icon: UserX,
      color: 'text-amber-400 bg-amber-500/10',
    },
    {
      key: 'problem' as FilterType,
      label: 'Проблеми',
      value: counts.problem,
      icon: ShieldAlert,
      color: 'text-red-400 bg-red-500/10',
    },
    {
      key: 'act_pending' as FilterType,
      label: 'Акти',
      value: counts.act_pending,
      icon: ClipboardCheck,
      color: 'text-blue-400 bg-blue-500/10',
    },
    {
      key: 'payout_pending' as FilterType,
      label: 'Виплати',
      value: counts.payout_pending,
      icon: Wallet,
      color: 'text-emerald-400 bg-emerald-500/10',
    },
  ];

  return (
    <PageHeader
      pageTitle="Центр контролю"
      pageSubtitle="Критичні події, прострочення та задачі, що потребують уваги"
      actions={
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Оновити
        </button>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {statCards.map(({ key, label, value, icon: Icon, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(current => current === key ? 'all' : key)}
            className={`rounded-xl border p-4 text-left transition ${
              filter === key
                ? 'border-blue-500/30 bg-blue-500/[0.06]'
                : 'border-white/[0.06] bg-[#141821] hover:border-white/10'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
                <Icon size={16} />
              </div>
              <span className="text-2xl font-semibold text-white">{value}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{label}</p>
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-red-500/10 bg-red-500/[0.035] p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="text-red-400" />
            <span className="text-xs text-slate-500">Критичні події</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{criticalCount}</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#141821] p-4">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-blue-400" />
            <span className="text-xs text-slate-500">Активні задачі</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{items.length}</p>
        </div>

        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.035] p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400" />
            <span className="text-xs text-slate-500">Стан системи</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-emerald-400">
            {items.length === 0 ? 'Все під контролем' : 'Потребує уваги'}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121720]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Загальний список</h3>
            <p className="mt-0.5 text-[11px] text-slate-600">
              {filtered.length} з {items.length} подій
            </p>
          </div>

          <div className="relative w-full lg:w-80">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Пошук задач..."
              className="w-full rounded-lg border border-white/[0.07] bg-white/[0.025] py-2.5 pl-9 pr-3 text-xs text-slate-300 outline-none placeholder:text-slate-700 focus:border-blue-500/30"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-white/[0.05] px-4 py-3">
          {[
            ['all', 'Усі', items.length],
            ['overdue', 'Прострочено', counts.overdue],
            ['no_contractor', 'Без підрядника', counts.no_contractor],
            ['problem', 'Проблеми', counts.problem],
            ['act_pending', 'Акти', counts.act_pending],
            ['payout_pending', 'Виплати', counts.payout_pending],
          ].map(([value, label, count]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setFilter(value as FilterType)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition ${
                filter === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/[0.025] text-slate-500 hover:bg-white/[0.05] hover:text-slate-300'
              }`}
            >
              {label}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 size={20} className="animate-spin text-slate-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
              <CheckCircle2 size={26} className="text-emerald-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-300">
              {items.length === 0 ? 'Все під контролем' : 'Подій не знайдено'}
            </p>
            <p className="mt-1 max-w-sm text-xs text-slate-600">
              {items.length === 0
                ? 'Критичних задач та подій, що потребують уваги, зараз немає.'
                : 'Змініть фільтр або пошуковий запит.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.045]">
            {filtered.map(item => {
              const Icon = typeIcons[item.type] ?? AlertTriangle;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openApplication(item)}
                  className="group flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.025] sm:gap-4 sm:px-5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      severityStyles[item.severity] ?? severityStyles.info
                    }`}
                  >
                    <Icon size={16} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-200">
                        {item.title}
                      </p>
                      <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-500">
                        {typeLabels[item.type] ?? item.type}
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {item.description}
                    </p>
                  </div>

                  <div className="hidden shrink-0 items-center gap-3 sm:flex">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${
                        severityStyles[item.severity] ?? severityStyles.info
                      }`}
                    >
                      {severityLabels[item.severity] ?? 'ІНФОРМАЦІЯ'}
                    </span>

                    <ChevronRight
                      size={15}
                      className="text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-blue-400"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </PageHeader>
  );
}

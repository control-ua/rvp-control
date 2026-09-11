import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, Loader2, RefreshCw, Users,
  Search, Receipt, CheckCircle2, Clock3, ArrowUpRight
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid
} from 'recharts';
import PageHeader from '@/components/PageHeader';
import { fetchFinanceStats, fetchFinanceDaily, fetchFinanceTopContractors } from '@/lib/financeApi';
import { fetchPayouts } from '@/lib/payoutsApi';
import { formatCurrency } from '@/utils/helpers';
import type { FinanceStats, FinanceDailyPoint, FinanceTopContractor } from '@/types';
import type { PayoutItem } from '@/lib/payoutsApi';

export default function Finance({
  onNavigateToPayouts,
}: {
  onNavigateToPayouts?: () => void;
}) {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [daily, setDaily] = useState<FinanceDailyPoint[]>([]);
  const [topContractors, setTopContractors] = useState<FinanceTopContractor[]>([]);
  const [recent, setRecent] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, d, t, p] = await Promise.all([
        fetchFinanceStats(),
        fetchFinanceDaily(30),
        fetchFinanceTopContractors(),
        fetchPayouts(),
      ]);
      setStats(s);
      setDaily(d);
      setTopContractors(t);
      setRecent(p.slice(0, 20));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: 'Нараховано сьогодні', value: stats?.accruedToday ?? 0, icon: TrendingUp, tone: 'blue' },
    { label: 'Нараховано за місяць', value: stats?.accruedThisMonth ?? 0, icon: TrendingUp, tone: 'emerald' },
    { label: 'Виплачено за місяць', value: stats?.paidThisMonth ?? 0, icon: CheckCircle2, tone: 'emerald' },
    { label: 'Очікує виплати', value: stats?.pendingPayout ?? 0, icon: Clock3, tone: 'amber' },
    { label: 'Загальна заборгованість', value: stats?.totalDebt ?? 0, icon: Wallet, tone: 'red' },
  ];

  const toneClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
  };

  const filteredRecent = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recent.slice(0, 8);
    return recent
      .filter(p =>
        [p.applicationNumber, p.contractorName, p.contractorPhone, p.payoutStatus]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 8);
  }, [recent, search]);

  const maxContractorPayout = useMemo(
    () => Math.max(1, ...topContractors.map(item => Number(item.totalPayout) || 0)),
    [topContractors]
  );

  return (
    <PageHeader
      pageTitle="Фінанси"
      pageSubtitle="Фінансовий центр RVP Control"
      actions={
        <div className="flex items-center gap-2">
          {onNavigateToPayouts && (
            <button
              type="button"
              onClick={onNavigateToPayouts}
              className="hidden items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] sm:flex"
            >
              <Wallet size={14} />
              Усі виплати
            </button>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Оновити
          </button>
        </div>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.06] bg-[#141821] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
                <Icon size={16} />
              </div>
              <ArrowUpRight size={13} className="text-slate-700" />
            </div>
            <p className="mt-4 truncate text-xl font-semibold text-white">
              {formatCurrency(value)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
        <div className="rounded-2xl border border-white/[0.06] bg-[#121720]">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Динаміка виплат</h3>
              <p className="mt-0.5 text-[11px] text-slate-600">Останні 30 днів</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <TrendingUp size={15} />
            </div>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex h-[280px] items-center justify-center">
                <Loader2 size={20} className="animate-spin text-slate-500" />
              </div>
            ) : daily.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-xs text-slate-600">
                Немає даних за вибраний період
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={daily} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={v => String(v).slice(5)}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      background: '#11161f',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-[#121720]">
          <div className="border-b border-white/[0.05] px-5 py-4">
            <h3 className="text-sm font-semibold text-white">Стан фінансів</h3>
            <p className="mt-0.5 text-[11px] text-slate-600">Поточний баланс виплат</p>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">Виплачено за місяць</span>
                <span className="text-xs font-medium text-emerald-400">
                  {formatCurrency(stats?.paidThisMonth ?? 0)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((stats?.paidThisMonth ?? 0) /
                        Math.max(1, (stats?.accruedThisMonth ?? 0))) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-600">Очікує</p>
                <p className="mt-2 text-sm font-semibold text-amber-400">
                  {formatCurrency(stats?.pendingPayout ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-wide text-slate-600">Борг</p>
                <p className="mt-2 text-sm font-semibold text-red-400">
                  {formatCurrency(stats?.totalDebt ?? 0)}
                </p>
              </div>
            </div>

            {onNavigateToPayouts && (
              <button
                type="button"
                onClick={onNavigateToPayouts}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                <Wallet size={14} />
                Перейти до виплат
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121720]">
          <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                <Users size={15} className="text-blue-400" />
                ТОП підрядників
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-600">За сумою виплат</p>
            </div>
          </div>

          {loading ? (
            <div className="flex h-[300px] items-center justify-center">
              <Loader2 size={20} className="animate-spin text-slate-500" />
            </div>
          ) : topContractors.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-xs text-slate-600">
              Даних немає
            </div>
          ) : (
            <div className="p-4">
              <ResponsiveContainer width="100%" height={210}>
                <BarChart
                  data={topContractors.slice(0, 7)}
                  layout="vertical"
                  margin={{ top: 0, right: 15, left: 5, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value ?? 0))}
                    contentStyle={{
                      background: '#11161f',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="totalPayout" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-3 space-y-1">
                {topContractors.slice(0, 5).map((contractor, index) => {
                  const value = Number(contractor.totalPayout) || 0;
                  return (
                    <div
                      key={`${contractor.name}-${index}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.025]"
                    >
                      <span className="w-5 text-center text-[10px] font-semibold text-slate-600">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-xs text-slate-300">
                            {contractor.name}
                          </span>
                          <span className="whitespace-nowrap text-xs font-medium text-white">
                            {formatCurrency(value)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${Math.max(3, (value / maxContractorPayout) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121720]">
          <div className="border-b border-white/[0.05] px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Receipt size={15} className="text-emerald-400" />
                  Останні виплати
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-600">Останні фінансові операції</p>
              </div>

              <div className="relative sm:w-56">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Пошук..."
                  className="w-full rounded-lg border border-white/[0.07] bg-white/[0.025] py-2 pl-8 pr-3 text-xs text-slate-300 outline-none placeholder:text-slate-700 focus:border-blue-500/30"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex h-[300px] items-center justify-center">
              <Loader2 size={20} className="animate-spin text-slate-500" />
            </div>
          ) : filteredRecent.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-xs text-slate-600">
              Виплат не знайдено
            </div>
          ) : (
            <div className="divide-y divide-white/[0.045]">
              {filteredRecent.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-blue-400">
                      {p.applicationNumber || '—'}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-400">
                      {p.contractorName || '—'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-100">
                      {formatCurrency(p.amount)}
                    </p>
                    <p
                      className={`mt-1 text-[10px] font-medium ${
                        p.payoutStatus === 'Виплачено'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {p.payoutStatus}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {onNavigateToPayouts && (
            <button
              type="button"
              onClick={onNavigateToPayouts}
              className="flex w-full items-center justify-center gap-2 border-t border-white/[0.05] px-4 py-3 text-xs text-slate-500 transition hover:bg-white/[0.02] hover:text-blue-400"
            >
              Переглянути всі виплати
              <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      </div>
    </PageHeader>
  );
}

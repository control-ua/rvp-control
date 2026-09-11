import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Loader2, AlertCircle, RefreshCw, BarChart3 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { fetchStatistics, type StatusDistribution, type DailyPoint, type MonthlyPayout, type ContractorRanking, type RegionStat } from '@/lib/statisticsApi';
import { formatCurrency } from '@/utils/helpers';

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444'];

const tooltipStyle = {
  backgroundColor: '#1a1f2e',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '12px',
};

const axisStyle = { fontSize: 11, fill: '#64748b' };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141720] border border-white/5 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-200 mb-5">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] text-slate-600">
      <BarChart3 size={28} className="text-slate-700 mb-2" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export default function Statistics() {
  const { showToast } = useApp();
  const [statusDist, setStatusDist] = useState<StatusDistribution[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [monthlyPayouts, setMonthlyPayouts] = useState<MonthlyPayout[]>([]);
  const [topContractors, setTopContractors] = useState<ContractorRanking[]>([]);
  const [regionStats, setRegionStats] = useState<RegionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStatistics();
      setStatusDist(data.statusDist);
      setDaily(data.daily);
      setMonthlyPayouts(data.monthlyPayouts);
      setTopContractors(data.topContractors);
      setRegionStats(data.regionStats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка завантаження статистики';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <PageHeader pageTitle="Статистика" pageSubtitle="Аналітика за поточний період">
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 size={18} className="animate-spin" /><span className="text-sm">Завантаження статистики…</span>
          </div>
        </div>
      </PageHeader>
    );
  }

  if (error) {
    return (
      <PageHeader pageTitle="Статистика" pageSubtitle="Аналітика за поточний період">
        <div className="flex flex-col items-center gap-3 py-20">
          <AlertCircle size={24} className="text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
            <RefreshCw size={14} /> Спробувати знову
          </button>
        </div>
      </PageHeader>
    );
  }

  const hasData = statusDist.length > 0 || daily.length > 0 || topContractors.length > 0;

  if (!hasData) {
    return (
      <PageHeader pageTitle="Статистика" pageSubtitle="Аналітика за поточний період">
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <BarChart3 size={32} className="text-slate-700 mb-3" />
          <p className="text-sm">Недостатньо даних для побудови графіків</p>
        </div>
      </PageHeader>
    );
  }

  return (
    <PageHeader pageTitle="Статистика" pageSubtitle="Аналітика за поточний період">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Заявки по днях">
          {daily.length === 0 ? <EmptyChart label="Немає даних" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={daily} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={axisStyle} tickFormatter={v => v.slice(5)} />
                <YAxis tick={axisStyle} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Line type="monotone" dataKey="заявки" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="виконані" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Заявки за статусом">
          {statusDist.length === 0 ? <EmptyChart label="Немає даних" /> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={220}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                    {statusDist.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {statusDist.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-slate-400">{s.name}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-200">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Виплати по місяцях">
          {monthlyPayouts.length === 0 ? <EmptyChart label="Немає даних" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyPayouts} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={axisStyle} />
                <YAxis tick={axisStyle} tickFormatter={v => (v / 1000) + 'к'} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrency(Number(value))]} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Bar dataKey="виплачено" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="очікує" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Топ підрядники за виконаними заявками">
          {topContractors.length === 0 ? <EmptyChart label="Немає даних" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topContractors} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={axisStyle} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={axisStyle} width={85} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="виконано" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {regionStats.length > 0 && (
        <div className="bg-[#141720] border border-white/5 rounded-xl p-5 mt-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">Заявки за регіонами</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {regionStats.map(r => (
              <div key={r.name} className="bg-white/[0.03] rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-white">{r.count}</p>
                <p className="text-xs text-slate-500 mt-1">{r.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageHeader>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Loader2,
  RefreshCw,
  UserRoundX,
  Wallet,
  Wrench,
} from 'lucide-react';

import type { Application } from '@/types';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import ApplicationActionDrawer from '@/components/ApplicationActionDrawer';
import { fetchApplications } from '@/lib/applicationsApi';
import { supabase } from '@/lib/supabase';
import { formatDateTime, getApplicationStatusColor } from '@/utils/helpers';
import { useApp } from '@/context/AppContext';

interface Props {
  onNavigateToApplications?: () => void;
}

type AttentionRow = {
  id: string;
  has_problem: boolean;
  problem_comment: string | null;
  contractor_stage: string | null;
  awaiting_act: boolean | null;
};

type ActRow = {
  id: string;
  application_id: string | null;
  status: string;
  created_at: string;
};

type PriorityItem = {
  app: Application;
  reason: string;
  cls: string;
  weight: number;
};

type QueueFilter =
  | 'all'
  | 'created'
  | 'unassigned'
  | 'deadline'
  | 'overdue'
  | 'waitingAct'
  | 'pendingActs'
  | 'payout';

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfToday() {
  const value = new Date();
  value.setHours(23, 59, 59, 999);
  return value;
}

function isFinal(app: Application) {
  return app.status === 'Виконана' || app.status === 'Скасована';
}

function isOverdue(app: Application) {
  if (!app.deadline || isFinal(app)) return false;
  const deadline = new Date(app.deadline);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();
}

function dueToday(app: Application) {
  if (!app.deadline || isFinal(app)) return false;
  const deadline = new Date(app.deadline);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline >= startOfToday() && deadline <= endOfToday();
}

function createdToday(app: Application) {
  const created = new Date(app.date);
  return created >= startOfToday() && created <= endOfToday();
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  onClick,
  active = false,
}: {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  tone: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[94px] flex-col items-start justify-between rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
        active
          ? 'border-blue-400/35 bg-blue-500/[0.08] ring-1 ring-blue-400/15'
          : 'border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.045]'
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={18} />
      </div>
      <div className="mt-3">
        <p className="text-2xl font-black tracking-tight text-white">{value}</p>
        <p className={`mt-0.5 text-[11px] font-medium ${active ? 'text-blue-300' : 'text-slate-500'}`}>{label}</p>
      </div>
    </button>
  );
}

function MobileMetricCard({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[72px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.98] ${
        active
          ? 'border-blue-400/35 bg-blue-500/[0.09] ring-1 ring-blue-400/15'
          : 'border-white/[0.07] bg-white/[0.025]'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold leading-4 text-slate-400">{label}</p>
        <p className="mt-0.5 text-xl font-black tracking-tight text-white">{value}</p>
      </div>
      <ChevronRight size={16} className={active ? 'text-blue-400' : 'text-slate-700'} />
    </button>
  );
}

function MobileMiniStat({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-w-0 rounded-2xl border px-2 py-3 text-center transition active:scale-[0.98] ${
        active
          ? 'border-blue-400/35 bg-blue-500/[0.09]'
          : 'border-white/[0.07] bg-white/[0.02]'
      }`}
    >
      <p className="text-lg font-black text-white">{value}</p>
      <p className={`mt-0.5 truncate text-[10px] font-semibold ${active ? 'text-blue-300' : 'text-slate-500'}`}>{label}</p>
    </button>
  );
}

function ApplicationRowCard({
  app,
  reason,
  reasonClass,
  onOpen,
}: {
  app: Application;
  reason: string;
  reasonClass: string;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:border-blue-500/20 hover:bg-blue-500/[0.035] sm:p-4"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-blue-400">{app.number}</span>
          <StatusBadge label={app.status} className={getApplicationStatusColor(app.status)} />
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${reasonClass}`}>{reason}</span>
        </div>
        <p className="mt-2 truncate text-sm font-semibold text-slate-200">{app.customer}</p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
          <span className="max-w-full truncate">{app.address || 'Без адреси'}</span>
          {app.deadline && <span className="hidden sm:inline">до {formatDateTime(app.deadline)}</span>}
          {app.contractorName && app.contractorName !== '—' && <span className="hidden sm:inline">{app.contractorName}</span>}
        </div>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-slate-600 transition group-hover:bg-blue-500/10 group-hover:text-blue-400">
        <ChevronRight size={18} />
      </div>
    </button>
  );
}

function makeQueueItems(
  apps: Application[],
  reason: string,
  cls: string,
): PriorityItem[] {
  return apps.map((app) => ({ app, reason, cls, weight: 1 }));
}

export default function Today({ onNavigateToApplications }: Props) {
  const { showToast } = useApp();
  const [applications, setApplications] = useState<Application[]>([]);
  const [attention, setAttention] = useState<Map<string, AttentionRow>>(new Map());
  const [acts, setActs] = useState<ActRow[]>([]);
  const [selected, setSelected] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appRows, attentionResult, actResult] = await Promise.all([
        fetchApplications(),
        supabase
          .from('applications')
          .select('id,has_problem,problem_comment,contractor_stage,awaiting_act'),
        supabase
          .from('acts')
          .select('id,application_id,status,created_at')
          .order('created_at', { ascending: false }),
      ]);

      if (attentionResult.error) throw attentionResult.error;
      if (actResult.error) throw actResult.error;

      setApplications(appRows);
      setAttention(
        new Map(
          ((attentionResult.data ?? []) as AttentionRow[]).map((row) => [row.id, row]),
        ),
      );
      setActs((actResult.data ?? []) as ActRow[]);
      setUpdatedAt(new Date());

      const params = new URLSearchParams(window.location.search);
      const applicationId = params.get('application');
      if (applicationId) {
        const target = appRows.find((app) => app.id === applicationId);
        if (target) setSelected(target);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не вдалося завантажити «Сьогодні»', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel('today-operations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'acts' }, () => void load())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const todayCreated = useMemo(() => applications.filter(createdToday), [applications]);
  const unassigned = useMemo(
    () => applications.filter((app) => !isFinal(app) && !app.contractorId),
    [applications],
  );
  const overdue = useMemo(() => applications.filter(isOverdue), [applications]);
  const todayDeadline = useMemo(() => applications.filter(dueToday), [applications]);
  const problems = useMemo(
    () => applications.filter((app) => attention.get(app.id)?.has_problem),
    [applications, attention],
  );

  const actByApplication = useMemo(() => {
    const map = new Map<string, ActRow[]>();
    for (const act of acts) {
      if (!act.application_id) continue;
      const list = map.get(act.application_id) ?? [];
      list.push(act);
      map.set(act.application_id, list);
    }
    return map;
  }, [acts]);

  const pendingActs = useMemo(
    () => acts.filter((act) => ['pending', 'review', 'on_review'].includes(act.status)),
    [acts],
  );

  const pendingActApplications = useMemo(() => {
    const ids = new Set(
      pendingActs
        .map((act) => act.application_id)
        .filter((id): id is string => Boolean(id)),
    );
    return applications.filter((app) => ids.has(app.id));
  }, [applications, pendingActs]);

  const waitingAct = useMemo(
    () => applications.filter((app) => {
      if (isFinal(app) || !attention.get(app.id)?.awaiting_act) return false;
      const appActs = actByApplication.get(app.id) ?? [];
      const hasSubmittedAct = appActs.some((act) =>
        ['pending', 'review', 'on_review', 'approved'].includes(act.status),
      );
      return !hasSubmittedAct;
    }),
    [applications, attention, actByApplication],
  );

  const waitingPayout = useMemo(
    () => applications.filter((app) => app.status === 'Виконана' && app.payoutStatus === 'Очікує'),
    [applications],
  );

  const priorityItems = useMemo(() => {
    const seen = new Set<string>();
    const result: PriorityItem[] = [];
    const add = (items: Application[], reason: string, cls: string, weight: number) => {
      for (const app of items) {
        if (seen.has(app.id)) continue;
        seen.add(app.id);
        result.push({ app, reason, cls, weight });
      }
    };

    add(problems, 'Проблема', 'border-rose-500/25 bg-rose-500/10 text-rose-300', 1);
    add(overdue, 'Прострочена', 'border-red-500/25 bg-red-500/10 text-red-300', 2);
    add(unassigned, 'Без підрядника', 'border-blue-500/25 bg-blue-500/10 text-blue-300', 3);
    add(todayDeadline, 'Дедлайн сьогодні', 'border-amber-500/25 bg-amber-500/10 text-amber-300', 4);
    add(waitingAct, 'Чекаємо акт', 'border-orange-500/25 bg-orange-500/10 text-orange-300', 5);
    add(waitingPayout, 'Чекає виплати', 'border-violet-500/25 bg-violet-500/10 text-violet-300', 6);

    return result.sort((a, b) => a.weight - b.weight).slice(0, 20);
  }, [problems, overdue, unassigned, todayDeadline, waitingAct, waitingPayout]);

  const attentionCount = useMemo(() => {
    const ids = new Set<string>();
    [problems, overdue, unassigned, todayDeadline, waitingAct, waitingPayout].forEach((list) => {
      list.forEach((app) => ids.add(app.id));
    });
    return ids.size;
  }, [problems, overdue, unassigned, todayDeadline, waitingAct, waitingPayout]);

  const filteredItems = useMemo<PriorityItem[]>(() => {
    switch (queueFilter) {
      case 'created':
        return makeQueueItems(todayCreated, 'Нова сьогодні', 'border-blue-500/25 bg-blue-500/10 text-blue-300');
      case 'unassigned':
        return makeQueueItems(unassigned, 'Без підрядника', 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300');
      case 'deadline':
        return makeQueueItems(todayDeadline, 'Дедлайн сьогодні', 'border-amber-500/25 bg-amber-500/10 text-amber-300');
      case 'overdue':
        return makeQueueItems(overdue, 'Прострочена', 'border-rose-500/25 bg-rose-500/10 text-rose-300');
      case 'waitingAct':
        return makeQueueItems(waitingAct, 'Чекаємо акт', 'border-orange-500/25 bg-orange-500/10 text-orange-300');
      case 'pendingActs':
        return makeQueueItems(pendingActApplications, 'Акт на перевірці', 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300');
      case 'payout':
        return makeQueueItems(waitingPayout, 'Чекає виплати', 'border-violet-500/25 bg-violet-500/10 text-violet-300');
      default:
        return priorityItems;
    }
  }, [queueFilter, todayCreated, unassigned, todayDeadline, overdue, waitingAct, pendingActApplications, waitingPayout, priorityItems]);

  const filterCopy: Record<QueueFilter, { title: string; subtitle: string }> = {
    all: { title: 'Потребують уваги', subtitle: 'Натисни на заявку — відкриється Центр дій' },
    created: { title: 'Нові сьогодні', subtitle: 'Заявки, створені сьогодні' },
    unassigned: { title: 'Без підрядника', subtitle: 'Потрібно призначити виконавця' },
    deadline: { title: 'Дедлайн сьогодні', subtitle: 'Роботи, які потрібно закрити сьогодні' },
    overdue: { title: 'Прострочені', subtitle: 'Дедлайн уже минув' },
    waitingAct: { title: 'Чекаємо акт', subtitle: 'Роботу завершено, але акт ще не завантажено' },
    pendingActs: { title: 'Акти на перевірці', subtitle: 'Акт уже надіслано — потрібна перевірка' },
    payout: { title: 'Чекають виплати', subtitle: 'Виконані заявки з очікуваною виплатою' },
  };

  const setOrToggleFilter = (next: QueueFilter) => {
    setQueueFilter((current) => (current === next ? 'all' : next));
  };

  const visibleItems = queueFilter === 'all' ? priorityItems : filteredItems;
  const activeCopy = filterCopy[queueFilter];

  return (
    <div className="p-3 pb-6 sm:p-5 lg:p-6">
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-3 px-1 pt-1">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">RVP Control</p>
            <h1 className="mt-1 text-[26px] font-black tracking-tight text-white">Сьогодні</h1>
            <p className="mt-0.5 text-xs text-slate-600">
              {updatedAt
                ? `Оновлено о ${updatedAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
                : 'Оперативний центр'}
            </p>
          </div>
          <button
            onClick={() => void load()}
            aria-label="Оновити"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-slate-400 active:scale-95"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="hidden sm:block">
        <PageHeader
          title="Сьогодні"
          subtitle="Що потребує уваги прямо зараз"
          action={
            <div className="flex items-center gap-2">
              {updatedAt && <span className="hidden text-[11px] text-slate-600 sm:inline">{updatedAt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</span>}
              <button
                onClick={() => void load()}
                className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs font-semibold text-slate-400 hover:text-white"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Оновити
              </button>
            </div>
          }
        />
      </div>

      {loading && applications.length === 0 ? (
        <div className="flex min-h-[45vh] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 size={18} className="animate-spin" /> Завантаження…
        </div>
      ) : (
        <>
          <div className="mt-4 sm:hidden">
            <div className="flex items-center justify-between rounded-3xl border border-blue-500/15 bg-gradient-to-br from-blue-500/[0.09] to-cyan-500/[0.03] px-4 py-3.5">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">Потребують уваги</p>
                <div className="mt-0.5 flex items-end gap-2">
                  <span className="text-3xl font-black tracking-tight text-white">{attentionCount}</span>
                  <span className="pb-1 text-[11px] text-slate-600">заявок</span>
                </div>
              </div>
              <button
                onClick={onNavigateToApplications}
                className="flex h-10 items-center gap-1.5 rounded-xl border border-blue-400/15 bg-blue-500/10 px-3 text-xs font-bold text-blue-300 active:scale-95"
              >
                Усі заявки <ChevronRight size={15} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <MobileMetricCard
                label="Прострочені"
                value={overdue.length}
                icon={AlertTriangle}
                tone="bg-rose-500/10 text-rose-400"
                active={queueFilter === 'overdue'}
                onClick={() => setOrToggleFilter('overdue')}
              />
              <MobileMetricCard
                label="Без підрядника"
                value={unassigned.length}
                icon={UserRoundX}
                tone="bg-cyan-500/10 text-cyan-400"
                active={queueFilter === 'unassigned'}
                onClick={() => setOrToggleFilter('unassigned')}
              />
              <MobileMetricCard
                label="Чекаємо акт"
                value={waitingAct.length}
                icon={Wrench}
                tone="bg-orange-500/10 text-orange-400"
                active={queueFilter === 'waitingAct'}
                onClick={() => setOrToggleFilter('waitingAct')}
              />
              <MobileMetricCard
                label="Акти на перевірці"
                value={pendingActApplications.length}
                icon={ClipboardCheck}
                tone="bg-emerald-500/10 text-emerald-400"
                active={queueFilter === 'pendingActs'}
                onClick={() => setOrToggleFilter('pendingActs')}
              />
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2">
              <MobileMiniStat
                label="Нові"
                value={todayCreated.length}
                active={queueFilter === 'created'}
                onClick={() => setOrToggleFilter('created')}
              />
              <MobileMiniStat
                label="Дедлайн"
                value={todayDeadline.length}
                active={queueFilter === 'deadline'}
                onClick={() => setOrToggleFilter('deadline')}
              />
              <MobileMiniStat
                label="Виплати"
                value={waitingPayout.length}
                active={queueFilter === 'payout'}
                onClick={() => setOrToggleFilter('payout')}
              />
            </div>
          </div>

          <div className="mt-5 hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3 xl:grid-cols-7">
            <MetricCard
              label="Нові сьогодні"
              value={todayCreated.length}
              icon={Clock3}
              tone="bg-blue-500/10 text-blue-400"
              active={queueFilter === 'created'}
              onClick={() => setOrToggleFilter('created')}
            />
            <MetricCard
              label="Без підрядника"
              value={unassigned.length}
              icon={UserRoundX}
              tone="bg-cyan-500/10 text-cyan-400"
              active={queueFilter === 'unassigned'}
              onClick={() => setOrToggleFilter('unassigned')}
            />
            <MetricCard
              label="Дедлайн сьогодні"
              value={todayDeadline.length}
              icon={CalendarClock}
              tone="bg-amber-500/10 text-amber-400"
              active={queueFilter === 'deadline'}
              onClick={() => setOrToggleFilter('deadline')}
            />
            <MetricCard
              label="Прострочені"
              value={overdue.length}
              icon={AlertTriangle}
              tone="bg-rose-500/10 text-rose-400"
              active={queueFilter === 'overdue'}
              onClick={() => setOrToggleFilter('overdue')}
            />
            <MetricCard
              label="Чекаємо акт"
              value={waitingAct.length}
              icon={Wrench}
              tone="bg-orange-500/10 text-orange-400"
              active={queueFilter === 'waitingAct'}
              onClick={() => setOrToggleFilter('waitingAct')}
            />
            <MetricCard
              label="Акти на перевірці"
              value={pendingActApplications.length}
              icon={ClipboardCheck}
              tone="bg-emerald-500/10 text-emerald-400"
              active={queueFilter === 'pendingActs'}
              onClick={() => setOrToggleFilter('pendingActs')}
            />
            <MetricCard
              label="Чекають виплати"
              value={waitingPayout.length}
              icon={Wallet}
              tone="bg-violet-500/10 text-violet-400"
              active={queueFilter === 'payout'}
              onClick={() => setOrToggleFilter('payout')}
            />
          </div>

          <div className="mt-4 grid gap-5 sm:mt-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,.55fr)]">
            <section className="rounded-3xl border border-white/[0.07] bg-[#0b1119] p-2.5 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-3 px-1.5 pt-1 sm:px-1 sm:pt-0">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-bold text-white sm:text-base">{activeCopy.title}</h2>
                  <p className="mt-0.5 hidden text-xs text-slate-600 sm:block">{activeCopy.subtitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {queueFilter !== 'all' && (
                    <button
                      onClick={() => setQueueFilter('all')}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-white sm:text-[11px]"
                    >
                      Усі
                    </button>
                  )}
                  <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-slate-400">{visibleItems.length}</span>
                </div>
              </div>
              <div className="space-y-2">
                {visibleItems.length === 0 ? (
                  <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-500/20 bg-emerald-500/[0.03] px-4 text-center sm:min-h-44">
                    <CheckCircle2 size={28} className="text-emerald-400" />
                    <p className="mt-2 text-sm font-semibold text-emerald-300">Нічого немає</p>
                    <p className="mt-1 text-xs text-slate-600">У цій черзі зараз немає заявок</p>
                  </div>
                ) : (
                  visibleItems.map(({ app, reason, cls }) => (
                    <ApplicationRowCard
                      key={app.id}
                      app={app}
                      reason={reason}
                      reasonClass={cls}
                      onOpen={() => setSelected(app)}
                    />
                  ))
                )}
              </div>
            </section>

            <aside className="hidden space-y-3 xl:block">
              <div className="rounded-3xl border border-white/[0.07] bg-[#0b1119] p-4">
                <h3 className="text-sm font-bold text-white">Автоматичний контроль</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">RVP Control сам стежить за заявками та надсилає push, коли потрібна реакція.</p>
                <div className="mt-4 space-y-2 text-xs">
                  {[
                    ['30 хв', 'без підрядника'],
                    ['24 год', 'до дедлайну'],
                    ['0 хв', 'прострочення'],
                    ['48 год', 'без змін у роботі'],
                    ['24 год', 'акт без перевірки'],
                    ['48 год', 'виплата очікує'],
                  ].map(([time, label]) => (
                    <div key={`${time}-${label}`} className="flex items-center justify-between rounded-xl bg-white/[0.025] px-3 py-2.5">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-mono font-bold text-slate-300">{time}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onNavigateToApplications}
                className="flex w-full items-center justify-between rounded-2xl border border-blue-500/15 bg-blue-500/[0.06] p-4 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-blue-300">Усі заявки</p>
                  <p className="mt-0.5 text-xs text-slate-600">Відкрити повний список</p>
                </div>
                <ChevronRight size={18} className="text-blue-400" />
              </button>
            </aside>
          </div>
        </>
      )}

      {selected && (
        <ApplicationActionDrawer
          application={selected}
          onClose={() => {
            setSelected(null);
            const params = new URLSearchParams(window.location.search);
            if (params.has('application')) {
              params.delete('application');
              params.delete('page');
              const next = params.toString();
              window.history.replaceState({}, '', `${window.location.pathname}${next ? `?${next}` : ''}`);
            }
          }}
          onChanged={async () => {
            await load();
            const refreshed = (await fetchApplications()).find((app) => app.id === selected.id);
            if (refreshed) setSelected(refreshed);
          }}
        />
      )}
    </div>
  );
}

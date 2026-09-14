import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  Filter,
  X,
  Phone,
  MapPin,
  Calendar,
  User,
  MessageSquare,
  Receipt,
  ChevronDown,
  Hash,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
  ExternalLink,
  History,
  Trash2,
} from 'lucide-react';

import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import NewApplicationModal from '@/components/NewApplicationModal';
import { useApp } from '@/context/AppContext';

import {
  fetchApplications,
  fetchLinkedActs,
  fetchWorkHistory,
  assignApplicationContractor,
  deleteSelectedApplications,
  updateApplicationStatus,
  type LinkedAct,
  type WorkHistoryEntry,
} from '@/lib/applicationsApi';

import {
  fetchContractors,
  type ContractorListItem,
} from '@/lib/contractorsApi';

import { telegramFileUrl } from '@/lib/actsApi';
import { supabase } from '@/lib/supabase';
import { tryCreateAuditLog } from '@/lib/auditLogApi';

import type {
  Application,
  ApplicationStatus,
} from '@/types';

import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getApplicationStatusColor,
  getPayoutStatusColor,
  getActStatusColor,
  actStatusLabel,
} from '@/utils/helpers';

const STATUSES: ApplicationStatus[] = [
  'Нова',
  'Прийнята',
  'В роботі',
  'Виконана',
  'Скасована',
];

const MOBILE_STATUS_ACCENT: Record<ApplicationStatus, string> = {
  'Нова': 'bg-blue-500',
  'Прийнята': 'bg-violet-500',
  'В роботі': 'bg-amber-500',
  'Виконана': 'bg-emerald-500',
  'Скасована': 'bg-rose-500',
};


function isStatusOverdue(
  deadlineValue: string | undefined,
  status: ApplicationStatus,
) {
  if (!deadlineValue) return false;

  const deadline = new Date(deadlineValue);
  if (Number.isNaN(deadline.getTime())) return false;

  const finished =
    status === 'Виконана' ||
    status === 'Скасована';

  return !finished && deadline < new Date();
}

function isApplicationOverdue(app: Application) {
  return isStatusOverdue(app.deadline, app.status);
}

function overdueDurationText(deadlineValue?: string) {
  if (!deadlineValue) return '';
  const deadline = new Date(deadlineValue);
  if (Number.isNaN(deadline.getTime())) return '';

  const diffMs = Date.now() - deadline.getTime();
  if (diffMs <= 0) return '';

  const totalHours = Math.max(1, Math.floor(diffMs / 3_600_000));
  if (totalHours < 24) return `Прострочено на ${totalHours} год.`;

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0
    ? `Прострочено на ${days} дн. ${hours} год.`
    : `Прострочено на ${days} дн.`;
}

function displayApplicationStatus(app: Application) {
  if (isApplicationOverdue(app)) return 'Прострочена';
  return app.status;
}

function applicationStatusColor(app: Application) {
  return isApplicationOverdue(app)
    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
    : getApplicationStatusColor(app.status);
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span
        className={`text-sm text-slate-200 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

function ApplicationModal({
  app,
  contractors,
  onClose,
  onAssigned,
}: {
  app: Application;
  contractors: ContractorListItem[];
  onClose: () => void;
  onAssigned: () => Promise<void> | void;
}) {
  const { showToast } = useApp();

  const [contractorId, setContractorId] =
    useState(app.contractorId || '');

  const [assigning, setAssigning] =
    useState(false);

  const [changingStatus, setChangingStatus] =
    useState<'in_progress' | 'completed' | null>(null);

  const [visibleStatus, setVisibleStatus] =
    useState<ApplicationStatus>(
      app.status
    );

  useEffect(() => {
    setVisibleStatus(
      app.status
    );
  }, [app.status, app.id]);

  const [linkedActs, setLinkedActs] =
    useState<LinkedAct[]>([]);

  const [history, setHistory] =
    useState<WorkHistoryEntry[]>([]);

  const [loadingExtra, setLoadingExtra] =
    useState(true);

  const [receiptUrl, setReceiptUrl] =
    useState<string | null>(null);

  useEffect(() => {
    setLoadingExtra(true);

    Promise.all([
      fetchLinkedActs(app.id).catch(
        () => [] as LinkedAct[]
      ),
      fetchWorkHistory(app.id).catch(
        () => [] as WorkHistoryEntry[]
      ),
    ])
      .then(([acts, hist]) => {
        setLinkedActs(acts);
        setHistory(hist);
      })
      .finally(() =>
        setLoadingExtra(false)
      );
  }, [app.id]);

  const handleViewReceipt = () => {
    if (!app.payoutReceipt) {
      showToast(
        'Квитанція не завантажена',
        'info'
      );
      return;
    }

    const url =
      telegramFileUrl(app.payoutReceipt);

    setReceiptUrl(url);
  };

  const handleStatusChange = async (
    status: 'in_progress' | 'completed'
  ) => {
    const previousStatus = visibleStatus;
    const optimisticStatus: ApplicationStatus =
      status === 'in_progress' ? 'В роботі' : 'Виконана';

    // Мгновенно меняем интерфейс, не ждём ответа сети.
    setVisibleStatus(optimisticStatus);
    setChangingStatus(status);

    try {
      const result = await updateApplicationStatus(
        app.id,
        status
      );

      showToast(
        result.telegramUpdated
          ? status === 'in_progress'
            ? 'Статус: «В роботі». Telegram-картку оновлено.'
            : 'Статус: «Виконана». Telegram-картку оновлено.'
          : result.warning ||
            'Статус змінено. Telegram-картка поки не оновилась.',
        result.telegramUpdated ? 'success' : 'info'
      );

      // Обновляем список в фоне, но модальное окно не закрываем.
      await onAssigned();
    } catch (err) {
      setVisibleStatus(previousStatus);
      showToast(
        err instanceof Error
          ? err.message
          : 'Не вдалося змінити статус',
        'error'
      );
    } finally {
      setChangingStatus(null);
    }
  };

  const handleAssignContractor = async () => {
    if (!contractorId) {
      showToast(
        'Оберіть підрядника',
        'error'
      );
      return;
    }

    if (
      app.contractorId &&
      app.contractorId === contractorId
    ) {
      showToast(
        'Цей підрядник уже призначений',
        'info'
      );
      return;
    }

    const previousContractorId =
      app.contractorId || null;

    const previousContractorName =
      app.contractorName &&
      app.contractorName !== '—'
        ? app.contractorName
        : null;

    const selectedContractor =
      contractors.find(
        (contractor) =>
          contractor.id === contractorId
      );

    const newContractorName =
      selectedContractor?.name ||
      'Підрядник';

    const isReassignment =
      Boolean(previousContractorId);

    setAssigning(true);

    try {
      await assignApplicationContractor(
        app.id,
        contractorId
      );

      await tryCreateAuditLog({
        action: isReassignment
          ? 'contractor_reassigned'
          : 'contractor_assigned',

        entityType: 'application',
        entityId: app.id,

        title: isReassignment
          ? 'Підрядника перепризначено'
          : 'Підрядника призначено',

        description: isReassignment
          ? `${app.number}: ${
              previousContractorName ||
              'Попередній підрядник'
            } → ${newContractorName}`
          : `${app.number}: ${newContractorName}`,

        metadata: {
          application_id: app.id,
          application_number: app.number,
          customer: app.customer,
          address: app.address,

          previous_contractor_id:
            previousContractorId,

          previous_contractor_name:
            previousContractorName,

          contractor_id:
            contractorId,

          contractor_name:
            newContractorName,

          contractor_phone:
            selectedContractor?.phone ||
            null,
        },
      });

      showToast(
        isReassignment
          ? 'Підрядника перепризначено. Заявку надіслано в Telegram.'
          : 'Підрядника призначено. Заявку надіслано в Telegram.',
        'success'
      );

      await onAssigned();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не вдалося призначити підрядника';

      showToast(
        message,
        'error'
      );
    } finally {
      setAssigning(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-[#141720] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#141720] border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-blue-400 font-semibold">
              {app.number}
            </span>

            <StatusBadge
              label={
                isStatusOverdue(app.deadline, visibleStatus)
                  ? 'Прострочена'
                  : visibleStatus
              }
              className={
                isStatusOverdue(app.deadline, visibleStatus)
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : getApplicationStatusColor(visibleStatus)
              }
            />
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <section
            className={`rounded-2xl border p-4 ${
              isStatusOverdue(app.deadline, visibleStatus)
                ? 'border-rose-500/40 bg-rose-500/[0.06] shadow-[0_0_0_1px_rgba(244,63,94,0.08)]'
                : 'border-white/5 bg-white/[0.025]'
            }`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Об&apos;єкт</p>
                <p className="mt-0.5 truncate text-base font-semibold text-white">
                  {app.customer || '—'}
                </p>
              </div>

              <div className="min-w-0 sm:text-right">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Підрядник</p>
                <p className="mt-0.5 truncate text-sm font-medium text-slate-200">
                  {app.contractorName && app.contractorName !== '—'
                    ? app.contractorName
                    : 'Не призначено'}
                </p>
              </div>

              <div className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-300">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-500" />
                <span className="leading-5">{app.address || 'Адреса не вказана'}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Calendar size={15} className="shrink-0 text-slate-500" />
                <span>
                  {app.deadline ? formatDateTime(app.deadline) : 'Без дедлайну'}
                </span>
              </div>

              <div className="flex items-center gap-2 sm:justify-end">
                <StatusBadge
                  label={
                    isStatusOverdue(app.deadline, visibleStatus)
                      ? 'Прострочена'
                      : visibleStatus
                  }
                  className={
                    isStatusOverdue(app.deadline, visibleStatus)
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : getApplicationStatusColor(visibleStatus)
                  }
                />
              </div>
            </div>

            {isStatusOverdue(app.deadline, visibleStatus) && (
              <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300">
                ⚠️ {overdueDurationText(app.deadline)}
              </div>
            )}
          </section>

          <section>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleStatusChange('in_progress')}
                disabled={
                  changingStatus !== null ||
                  visibleStatus === 'В роботі' ||
                  visibleStatus === 'Виконана' ||
                  visibleStatus === 'Скасована'
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 text-sm font-semibold text-blue-300 transition-colors hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {changingStatus === 'in_progress' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Clock size={16} />
                )}
                В роботу
              </button>

              <button
                onClick={() => handleStatusChange('completed')}
                disabled={
                  changingStatus !== null ||
                  visibleStatus === 'Виконана' ||
                  visibleStatus === 'Скасована'
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {changingStatus === 'completed' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Виконана
              </button>
            </div>
          </section>

          <details className="group rounded-xl border border-white/5 bg-white/[0.02]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-300">
              Деталі заявки
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid grid-cols-1 gap-4 border-t border-white/5 px-4 py-4 sm:grid-cols-2">
              <DetailRow label="Код АЗК" value={app.azkCode ?? '—'} />
              <DetailRow label="Дата заявки" value={formatDate(app.date)} />
              {app.scheduledDate && (
                <DetailRow label="Запланований виїзд" value={formatDateTime(app.scheduledDate)} />
              )}
              <div className="sm:col-span-2">
                <DetailRow label="Опис / потреба" value={app.description || '—'} />
              </div>
            </div>
          </details>

          <div className="h-px bg-white/5" />

          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Підрядник
            </h3>

            {app.contractorId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <DetailRow
                  label="ПІБ"
                  value={
                    <span className="flex items-center gap-1">
                      <User
                        size={12}
                        className="text-slate-500"
                      />
                      {app.contractorName}
                    </span>
                  }
                />

                <DetailRow
                  label="Телефон"
                  value={
                    app.contractorPhone &&
                    app.contractorPhone !==
                      '—' ? (
                      <a
                        href={`tel:${app.contractorPhone}`}
                        className="text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Phone size={12} />
                        {
                          app.contractorPhone
                        }
                      </a>
                    ) : (
                      '—'
                    )
                  }
                />
              </div>
            )}

            <div
              className={`rounded-xl border p-4 ${
                app.contractorId
                  ? 'border-white/10 bg-white/[0.025]'
                  : 'border-blue-500/20 bg-blue-500/[0.06]'
              }`}
            >
              <p className="text-sm text-slate-300 mb-3">
                {app.contractorId
                  ? 'Можна перепризначити заявку іншому підряднику.'
                  : 'Заявка ще не призначена підряднику.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={contractorId}
                  onChange={(event) =>
                    setContractorId(
                      event.target.value
                    )
                  }
                  disabled={assigning}
                  className="flex-1 bg-[#0f1219] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">
                    Оберіть підрядника
                  </option>

                  {contractors
                    .filter(
                      (contractor) =>
                        contractor.status ===
                        'active'
                    )
                    .map((contractor) => (
                      <option
                        key={
                          contractor.id
                        }
                        value={
                          contractor.id
                        }
                      >
                        {contractor.name}
                        {contractor.phone
                          ? ` • ${contractor.phone}`
                          : ''}
                      </option>
                    ))}
                </select>

                <button
                  onClick={
                    handleAssignContractor
                  }
                  disabled={
                    !contractorId ||
                    assigning ||
                    contractorId ===
                      app.contractorId
                  }
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {assigning && (
                    <Loader2
                      size={14}
                      className="animate-spin"
                    />
                  )}

                  {app.contractorId
                    ? 'Перепризначити'
                    : 'Призначити'}
                </button>
              </div>
            </div>
          </section>

          <div className="h-px bg-white/5" />

          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Фінанси
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-4">
              <DetailRow
                label="Об'єм (факт.)"
                value={
                  app.actualVolume
                    ? `${app.actualVolume} м³`
                    : '—'
                }
              />

              <DetailRow
                label="Ціна за од."
                value={
                  app.unitPrice
                    ? formatCurrency(
                        app.unitPrice
                      )
                    : '—'
                }
              />

              <DetailRow
                label="Сума замовника"
                value={formatCurrency(
                  app.amount
                )}
              />

              <div>
                <span className="text-xs text-slate-500">
                  Сума виплати
                </span>

                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-slate-200">
                    {app.payoutAmount
                      ? formatCurrency(
                          app.payoutAmount
                        )
                      : '—'}
                  </span>

                  <StatusBadge
                    label={
                      app.payoutStatus
                    }
                    className={getPayoutStatusColor(
                      app.payoutStatus
                    )}
                  />
                </div>
              </div>
            </div>

            {app.payoutReceipt && (
              <button
                onClick={
                  handleViewReceipt
                }
                className="mt-3 flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Receipt size={14} />
                Переглянути квитанцію
                {app.payoutReceiptName
                  ? ` (${app.payoutReceiptName})`
                  : ''}
              </button>
            )}
          </section>

          {app.managerComment && (
            <>
              <div className="h-px bg-white/5" />

              <section>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Коментар менеджера
                </h3>

                <div className="bg-white/[0.03] rounded-lg p-3 text-sm text-slate-300 flex gap-2">
                  <MessageSquare
                    size={14}
                    className="text-slate-500 mt-0.5 shrink-0"
                  />
                  {app.managerComment}
                </div>
              </section>
            </>
          )}

          <div className="h-px bg-white/5" />

          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Пов&apos;язані акти
            </h3>

            {loadingExtra ? (
              <div className="flex items-center gap-2 text-slate-500 py-3">
                <Loader2
                  size={14}
                  className="animate-spin"
                />
                <span className="text-sm">
                  Завантаження…
                </span>
              </div>
            ) : linkedActs.length ===
              0 ? (
              <p className="text-sm text-slate-500">
                Актів немає
              </p>
            ) : (
              <div className="space-y-2">
                {linkedActs.map((act) => {
                  const previewUrl = act.previewFileId
                    ? telegramFileUrl(act.previewFileId)
                    : null;
                  const isPhoto =
                    act.previewFileType === 'photo' ||
                    Boolean(act.previewFileName?.match(/\.(jpg|jpeg|png|webp)$/i));

                  return (
                    <div
                      key={act.id}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.025] p-2.5"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/5 bg-[#0d1118]">
                        {previewUrl && isPhoto ? (
                          <img
                            src={previewUrl}
                            alt={act.actNumber || 'Акт'}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <FileText size={20} className="text-slate-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-mono text-xs font-semibold text-blue-400">
                            {act.actNumber ?? '—'}
                          </span>
                          <StatusBadge
                            label={actStatusLabel(act.status)}
                            className={getActStatusColor(act.status)}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(act.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="h-px bg-white/5" />

          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <History size={14} />
              Історія робіт
            </h3>

            {loadingExtra ? (
              <div className="flex items-center gap-2 text-slate-500 py-3">
                <Loader2
                  size={14}
                  className="animate-spin"
                />
                <span className="text-sm">
                  Завантаження…
                </span>
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-500">
                Записів історії немає
              </p>
            ) : (
              <div className="space-y-2">
                {history.map(
                  (entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 bg-white/[0.03] rounded-lg px-4 py-3"
                    >
                      <CheckCircle2
                        size={16}
                        className="text-emerald-400 mt-0.5 shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200">
                          {entry.title}
                        </p>

                        {entry.description && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {
                              entry.description
                            }
                          </p>
                        )}

                        <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                          <Clock
                            size={11}
                          />
                          {formatDateTime(
                            entry.completedAt
                          )}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 bg-[#141720] border-t border-white/5 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>

      {receiptUrl && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          onClick={() =>
            setReceiptUrl(null)
          }
        >
          <div className="absolute inset-0 bg-black/70" />

          <div
            className="relative bg-[#141720] border border-white/10 rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="sticky top-0 bg-[#141720] border-b border-white/5 px-6 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                Квитанція
              </span>

              <button
                onClick={() =>
                  setReceiptUrl(null)
                }
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-white/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 sm:p-4 lg:p-6">
              <img
                src={receiptUrl}
                alt="Квитанція"
                className="w-full rounded-xl"
                onError={() =>
                  showToast(
                    'Не вдалося завантажити квитанцію',
                    'error'
                  )
                }
              />

              <a
                href={receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-2 text-sm text-blue-400 hover:underline"
              >
                <ExternalLink
                  size={14}
                />
                Відкрити в новій вкладці
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    modal,
    document.body
  );
}

type ApplicationDashboardFilter =
  | 'all'
  | 'new'
  | 'accepted'
  | 'work'
  | 'done'
  | 'overdue'
  | 'today'
  | 'tomorrow';

type ApplicationsProps = {
  dashboardFilter?: ApplicationDashboardFilter;
  onDashboardFilterChange?: (filter: ApplicationDashboardFilter) => void;
};

export default function Applications({
  dashboardFilter = 'all',
  onDashboardFilterChange,
}: ApplicationsProps) {
  const { showToast } = useApp();

  const [applications, setApplications] =
    useState<Application[]>([]);

  const [contractors, setContractors] =
    useState<ContractorListItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<ApplicationStatus | ''>('');

  const [
    contractorFilter,
    setContractorFilter,
  ] = useState('');

  const [dateFrom, setDateFrom] =
    useState('');

  const [dateTo, setDateTo] =
    useState('');

  const setDashboardFilter = (filter: ApplicationDashboardFilter) => {
    onDashboardFilterChange?.(filter);
  };

  const [selected, setSelected] =
    useState<Application | null>(null);

  const [showFilters, setShowFilters] =
    useState(false);

  const [
    showNewModal,
    setShowNewModal,
  ] = useState(false);

  const loadApplications =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          appData,
          contractorData,
        ] = await Promise.all([
          fetchApplications(),
          fetchContractors().catch(
            () =>
              [] as ContractorListItem[]
          ),
        ]);

        setApplications(appData);
        setContractors(
          contractorData
        );
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Помилка завантаження заявок';

        setError(msg);
        showToast(msg, 'error');
      } finally {
        setLoading(false);
      }
    }, [showToast]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  // Live sync: new/updated/deleted applications appear without reloading the app.
  useEffect(() => {
    const channel = supabase
      .channel('applications-page-live-sync')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'applications' },
        () => loadApplications(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'applications' },
        () => loadApplications(),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'applications' },
        () => loadApplications(),
      )
      .subscribe();

    // Fallback for iPhone/PWA: refresh every 15 seconds in case Realtime reconnects late.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadApplications();
      }
    }, 15000);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadApplications();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [loadApplications]);

  const filtered = useMemo(() => {
    return applications.filter(
      (app) => {
        if (search) {
          const q =
            search
              .toLowerCase()
              .trim();

          const num =
            (
              app.number || ''
            ).toLowerCase();

          const cust =
            (
              app.customer || ''
            ).toLowerCase();

          const addr =
            (
              app.address || ''
            ).toLowerCase();

          const con =
            (
              app.contractorName ||
              ''
            ).toLowerCase();

          const azk =
            (
              app.azkCode || ''
            ).toLowerCase();

          const phoneDigits =
            (
              app.contractorPhone ||
              ''
            ).replace(/\D/g, '');

          const searchDigits =
            q.replace(/\D/g, '');

          const phoneMatch =
            searchDigits.length >
              0 &&
            phoneDigits.includes(
              searchDigits
            );

          if (
            !num.includes(q) &&
            !cust.includes(q) &&
            !addr.includes(q) &&
            !con.includes(q) &&
            !azk.includes(q) &&
            !phoneMatch
          ) {
            return false;
          }
        }

        if (
          statusFilter &&
          app.status !==
            statusFilter
        ) {
          return false;
        }

        if (
          contractorFilter &&
          app.contractorId !==
            contractorFilter
        ) {
          return false;
        }

        if (
          dateFrom &&
          (app.date || '') <
            dateFrom
        ) {
          return false;
        }

        if (
          dateTo &&
          (app.date || '') >
            dateTo
        ) {
          return false;
        }

        if (dashboardFilter !== 'all') {
          const statusByDashboardFilter: Partial<Record<ApplicationDashboardFilter, ApplicationStatus>> = {
            new: 'Нова',
            accepted: 'Прийнята',
            work: 'В роботі',
            done: 'Виконана',
          };

          const requiredStatus = statusByDashboardFilter[dashboardFilter];
          if (requiredStatus && app.status !== requiredStatus) {
            return false;
          }

          if (dashboardFilter === 'overdue' || dashboardFilter === 'today' || dashboardFilter === 'tomorrow') {
            if (!app.deadline) return false;

            const deadline = new Date(app.deadline);
            if (Number.isNaN(deadline.getTime())) return false;

            const now = new Date();
            const startToday = new Date(now);
            startToday.setHours(0, 0, 0, 0);

            const startTomorrow = new Date(startToday);
            startTomorrow.setDate(startTomorrow.getDate() + 1);

            const startAfterTomorrow = new Date(startTomorrow);
            startAfterTomorrow.setDate(startAfterTomorrow.getDate() + 1);

            const isDone = app.status === 'Виконана' || app.status === 'Скасована';
            if (isDone) return false;

            if (dashboardFilter === 'overdue' && !(deadline < now)) return false;
            if (dashboardFilter === 'today' && !(deadline >= startToday && deadline < startTomorrow)) return false;
            if (dashboardFilter === 'tomorrow' && !(deadline >= startTomorrow && deadline < startAfterTomorrow)) return false;
          }
        }

        return true;
      }
    );
  }, [
    applications,
    search,
    statusFilter,
    contractorFilter,
    dateFrom,
    dateTo,
    dashboardFilter,
  ]);

  const hasFilters =
    statusFilter ||
    contractorFilter ||
    dateFrom ||
    dateTo;

  const filteredIds = useMemo(
    () => filtered.map((app) => app.id),
    [filtered],
  );

  const allFilteredSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => selectedIds.has(id));

  const toggleSelected = (applicationId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const handleDeleteSelectedApplications = async () => {
    const ids = [...selectedIds];

    if (ids.length === 0 || deletingSelected) return;

    const confirmed = window.confirm(
      `Видалити вибрані заявки (${ids.length})?\n\n` +
        'Вони одразу зникнуть з RVP Control. Також буде виконано очищення ' +
        'збережених карток у Telegram-боті та повʼязаних повідомлень актів у групі.'
    );

    if (!confirmed) return;

    const previousApplications = applications;

    // Optimistic UI: selected applications disappear immediately.
    setApplications((current) =>
      current.filter((app) => !selectedIds.has(app.id))
    );
    setSelectedIds(new Set());

    if (selected && ids.includes(selected.id)) {
      setSelected(null);
    }

    setDeletingSelected(true);

    try {
      const result = await deleteSelectedApplications(ids);

      if (result.failed === 0) {
        showToast(`Видалено ${result.deleted} заявок`, 'success');
      } else {
        showToast(
          `Видалено ${result.deleted} з ${result.total}. Не вдалося: ${result.failed}`,
          'error'
        );

        // Reload only when the backend reported partial failure.
        await loadApplications();
      }
    } catch (error) {
      // Restore immediately if the server request itself failed.
      setApplications(previousApplications);
      showToast(
        error instanceof Error ? error.message : 'Не вдалося видалити вибрані заявки',
        'error'
      );
      await loadApplications().catch(() => undefined);
    } finally {
      setDeletingSelected(false);
    }
  };

  return (
    <>
      <PageHeader
        pageTitle="Заявки"
        pageSubtitle={`${filtered.length} з ${applications.length} заявок`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              disabled={filtered.length === 0 || deletingSelected}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              title="Вибрати всі заявки, які зараз показані"
            >
              <CheckCircle2 size={16} />
              <span className="hidden sm:inline">
                {allFilteredSelected ? 'Зняти вибір' : 'Вибрати всі'}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelectedApplications}
                disabled={deletingSelected}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                title="Видалити вибрані заявки з RVP Control і Telegram"
              >
                {deletingSelected ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Trash2 size={16} />
                )}
                <span>Видалити ({selectedIds.size})</span>
              </button>
            )}

            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              Нова заявка
            </button>
          </div>
        }
      >
        <div className="bg-[#141720] border border-white/5 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-5 space-y-3">
          {dashboardFilter !== 'all' && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-500/15 bg-blue-500/[0.07] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-blue-400/70">
                  Фільтр з головної
                </p>
                <p className="truncate text-sm font-medium text-blue-300">
                  {dashboardFilter === 'new'
                    ? 'Нова'
                    : dashboardFilter === 'accepted'
                    ? 'Прийнята'
                    : dashboardFilter === 'work'
                    ? 'В роботі'
                    : dashboardFilter === 'done'
                    ? 'Виконана'
                    : dashboardFilter === 'overdue'
                    ? 'Прострочені'
                    : dashboardFilter === 'today'
                    ? 'Дедлайн сьогодні'
                    : 'Дедлайн на завтра'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDashboardFilter('all')}
                className="shrink-0 rounded-lg bg-white/5 p-2 text-slate-400 hover:text-white"
                aria-label="Скинути фільтр"
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="w-full sm:flex-1 sm:min-w-[200px] relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                type="text"
                placeholder="Пошук за номером, АЗК, адресою, телефоном..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                className="w-full bg-white/5 border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition"
              />
            </div>

            <button
              onClick={() =>
                setShowFilters(
                  !showFilters
                )
              }
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border transition-colors ${
                hasFilters
                  ? 'bg-blue-600/15 text-blue-400 border-blue-500/20'
                  : 'bg-white/5 text-slate-400 border-white/5 hover:text-slate-200'
              }`}
            >
              <Filter size={15} />
              Фільтри

              {hasFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              )}

              <ChevronDown
                size={14}
                className={`transition-transform ${
                  showFilters
                    ? 'rotate-180'
                    : ''
                }`}
              />
            </button>

            {hasFilters && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setContractorFilter('');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-sm text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
              >
                <X size={14} />
                Скинути
              </button>
            )}
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-white/5">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value as
                      | ApplicationStatus
                      | ''
                  )
                }
                className="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition"
              >
                <option value="">
                  Усі статуси
                </option>

                {STATUSES.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  contractorFilter
                }
                onChange={(event) =>
                  setContractorFilter(
                    event.target.value
                  )
                }
                className="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition"
              >
                <option value="">
                  Усі підрядники
                </option>

                {contractors.map(
                  (contractor) => (
                    <option
                      key={
                        contractor.id
                      }
                      value={
                        contractor.id
                      }
                    >
                      {
                        contractor.name
                      }
                    </option>
                  )
                )}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) =>
                    setDateFrom(
                      event.target.value
                    )
                  }
                  className="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition"
                />

                <span className="text-slate-600 text-sm">
                  —
                </span>

                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) =>
                    setDateTo(
                      event.target.value
                    )
                  }
                  className="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition"
                />
              </div>
            </div>
          )}
        </div>

        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/5 bg-[#141720] px-4 py-10">
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Завантаження заявок…</span>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/10 bg-[#141720] px-4 py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertCircle size={24} className="text-red-400" />
                <span className="text-sm text-red-400">{error}</span>
                <button
                  onClick={loadApplications}
                  className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300"
                >
                  <RefreshCw size={14} />
                  Спробувати знову
                </button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-[#141720] px-4 py-10 text-center text-sm text-slate-500">
              Заявки не знайдено
            </div>
          ) : (
            filtered.map((app) => {
              const callPhone = app.phone || app.contractorPhone || '';

              return (
                <div
                  key={app.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(app)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(app);
                    }
                  }}
                  className={`relative w-full overflow-hidden rounded-2xl border bg-[#141720] p-3.5 pl-4.5 text-left shadow-[0_10px_30px_rgba(0,0,0,0.15)] transition active:scale-[0.99] ${
                    isApplicationOverdue(app)
                      ? 'border-rose-500/50 bg-rose-500/[0.035] ring-1 ring-rose-500/15'
                      : selectedIds.has(app.id)
                        ? 'border-red-500/40 ring-1 ring-red-500/20'
                        : 'border-white/5'
                  }`}
                >
                  <button
                    type="button"
                    aria-label={selectedIds.has(app.id) ? 'Зняти вибір' : 'Вибрати заявку'}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSelected(app.id);
                    }}
                    className={`absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                      selectedIds.has(app.id)
                        ? 'border-red-500/40 bg-red-500/15 text-red-300'
                        : 'border-white/10 bg-[#0d1118]/90 text-slate-500'
                    }`}
                  >
                    {selectedIds.has(app.id) ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <span className="h-4 w-4 rounded border border-current" />
                    )}
                  </button>
                  <span
                    className={`absolute inset-y-0 left-0 w-1 ${MOBILE_STATUS_ACCENT[app.status]}`}
                  />

                  <div className="mb-3 flex items-start justify-between gap-3 pr-10">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-lg font-bold tracking-tight text-blue-400">
                          {app.number}
                        </span>
                        <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-500">
                          {formatDate(app.date)}
                        </span>
                      </div>

                      <div className="mt-1.5 truncate text-base font-semibold text-white">
                        {app.customer || 'Без замовника'}
                      </div>
                    </div>

                    <StatusBadge
                      label={displayApplicationStatus(app)}
                      className={applicationStatusColor(app)}
                    />
                  </div>

                  {isApplicationOverdue(app) && (
                    <div className="mb-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300">
                      ⚠️ {overdueDurationText(app.deadline)}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-sm text-slate-400">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-slate-600" />
                      <span className="line-clamp-2 leading-5">
                        {app.address || 'Адреса не вказана'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <User size={16} className="shrink-0 text-slate-600" />
                      <span className="truncate">
                        {app.contractorName || 'Підрядника не призначено'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                    <span className="text-xs text-slate-500">
                      Сума
                    </span>
                    <span className="text-base font-semibold text-white">
                      {(app.amount ?? 0).toLocaleString('uk-UA')} ₴
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {callPhone ? (
                      <a
                        href={`tel:${callPhone}`}
                        onClick={(event) => event.stopPropagation()}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.035] px-2 text-xs font-medium text-slate-300 active:bg-white/[0.08]"
                      >
                        <Phone size={15} />
                        Подзвонити
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        onClick={(event) => event.stopPropagation()}
                        className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-2 text-xs font-medium text-slate-600"
                      >
                        <Phone size={15} />
                        Подзвонити
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(app);
                      }}
                      className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-blue-500/15 bg-blue-500/[0.07] px-2 text-xs font-medium text-blue-400 active:bg-blue-500/[0.13]"
                    >
                      <ExternalLink size={15} />
                      Відкрити
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(app);
                      }}
                      className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-violet-500/15 bg-violet-500/[0.07] px-2 text-xs font-medium text-violet-400 active:bg-violet-500/[0.13]"
                    >
                      <User size={15} />
                      Призначити
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block bg-[#141720] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto mobile-no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="w-12 px-4 py-3">
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className={`flex h-5 w-5 items-center justify-center rounded border ${
                        allFilteredSelected
                          ? 'border-red-500/50 bg-red-500/15 text-red-300'
                          : 'border-white/15 text-slate-500'
                      }`}
                      aria-label={allFilteredSelected ? 'Зняти вибір' : 'Вибрати всі'}
                    >
                      {allFilteredSelected && <CheckCircle2 size={14} />}
                    </button>
                  </th>
                  {[
                    '№ заявки',
                    'Дата',
                    'Замовник',
                    'Адреса',
                    'Підрядник',
                    'Тел. підрядника',
                    'Статус',
                    'Сума',
                    'Дії',
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="text-left text-xs text-slate-500 font-medium px-4 py-3 whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-12"
                    >
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <Loader2
                          size={18}
                          className="animate-spin"
                        />

                        <span className="text-sm">
                          Завантаження заявок…
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-12"
                    >
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <AlertCircle
                          size={24}
                          className="text-red-400"
                        />

                        <span className="text-sm text-red-400">
                          {error}
                        </span>

                        <button
                          onClick={
                            loadApplications
                          }
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <RefreshCw
                            size={14}
                          />
                          Спробувати знову
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="text-center py-12 text-slate-500"
                    >
                      Заявки не знайдено
                    </td>
                  </tr>
                ) : (
                  filtered.map(
                    (app, index) => (
                      <tr
                        key={app.id}
                        className={`border-b hover:bg-white/[0.02] transition-colors cursor-pointer ${
                          selectedIds.has(app.id)
                            ? 'border-red-500/20 bg-red-500/[0.04]'
                            : 'border-white/5'
                        } ${
                          index ===
                          filtered.length -
                            1
                            ? 'border-0'
                            : ''
                        }`}
                        onClick={() =>
                          setSelected(app)
                        }
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSelected(app.id);
                            }}
                            className={`flex h-5 w-5 items-center justify-center rounded border ${
                              selectedIds.has(app.id)
                                ? 'border-red-500/50 bg-red-500/15 text-red-300'
                                : 'border-white/15 text-slate-500'
                            }`}
                            aria-label={selectedIds.has(app.id) ? 'Зняти вибір' : 'Вибрати заявку'}
                          >
                            {selectedIds.has(app.id) && <CheckCircle2 size={14} />}
                          </button>
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-blue-400">
                            {app.number}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {formatDate(
                            app.date
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-200 font-medium max-w-[160px] truncate">
                          {app.customer}
                        </td>

                        <td className="px-4 py-3 text-slate-400 max-w-[180px] truncate">
                          {app.address}
                        </td>

                        <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">
                          {
                            app.contractorName
                          }
                        </td>

                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {
                            app.contractorPhone
                          }
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge
                            label={displayApplicationStatus(app)}
                            className={applicationStatusColor(app)}
                          />
                        </td>

                        <td className="px-4 py-3 text-slate-200 font-medium whitespace-nowrap">
                          {(
                            app.amount ?? 0
                          ).toLocaleString(
                            'uk-UA'
                          )}{' '}
                          ₴
                        </td>

                        <td className="px-4 py-3">
                          <button
                            onClick={(
                              event
                            ) => {
                              event.stopPropagation();
                              setSelected(
                                app
                              );
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                          >
                            Деталі
                          </button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageHeader>

      {selected && (
        <ApplicationModal
          app={selected}
          contractors={
            contractors
          }
          onClose={() =>
            setSelected(null)
          }
          onAssigned={
            loadApplications
          }
        />
      )}

      {showNewModal && (
        <NewApplicationModal
          onClose={() =>
            setShowNewModal(false)
          }
          onCreated={
            loadApplications
          }
        />
      )}
    </>
  );
}

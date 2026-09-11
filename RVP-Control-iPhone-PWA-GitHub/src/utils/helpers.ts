import type { ApplicationStatus, PayoutStatus } from '@/types';

export type ContractorDbStatus = 'active' | 'inactive';

const CONTRACTOR_STATUS_LABELS: Record<ContractorDbStatus, string> = {
  active: 'Активний',
  inactive: 'Неактивний',
};

export function contractorStatusLabel(status: string): string {
  if (status === 'active' || status === 'inactive') return CONTRACTOR_STATUS_LABELS[status];
  return status;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('uk-UA') + ' грн';
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_ALIASES: Record<string, ApplicationStatus> = {
  new: 'Нова',
  pending: 'Нова',
  assigned: 'Прийнята',
  accepted: 'Прийнята',
  in_progress: 'В роботі',
  completed: 'Виконана',
  done: 'Виконана',
  cancelled: 'Скасована',
  canceled: 'Скасована',
};

export function normalizeStatus(raw: string): ApplicationStatus {
  if (!raw) return 'Нова';
  if ((['Нова', 'Прийнята', 'В роботі', 'Виконана', 'Скасована'] as const).includes(raw as ApplicationStatus)) {
    return raw as ApplicationStatus;
  }
  const alias = STATUS_ALIASES[raw.toLowerCase()];
  return alias ?? (raw as ApplicationStatus);
}

const PAYOUT_ALIASES: Record<string, PayoutStatus> = {
  pending: 'Очікує',
  paid: 'Виплачено',
  waiting: 'Очікує',
  completed: 'Виплачено',
};

export function normalizePayoutStatus(raw: string): PayoutStatus {
  if (!raw) return 'Очікує';
  if (raw === 'Очікує' || raw === 'Виплачено') return raw;
  return PAYOUT_ALIASES[raw.toLowerCase()] ?? 'Очікує';
}

export function getApplicationStatusColor(status: ApplicationStatus): string {
  switch (status) {
    case 'Нова': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'Прийнята': return 'text-violet-400 bg-violet-400/10 border-violet-400/20';
    case 'В роботі': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'Виконана': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'Скасована': return 'text-red-400 bg-red-400/10 border-red-400/20';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
}

export function getPayoutStatusColor(status: PayoutStatus): string {
  switch (status) {
    case 'Очікує': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'Виплачено': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  }
}

export function getContractorStatusColor(status: string): string {
  const s = status === 'Активний' ? 'active' : status === 'Неактивний' ? 'inactive' : status;
  switch (s) {
    case 'active': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'inactive': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
}

export function getActStatusColor(status: string): string {
  const s = status === 'Підтверджено' ? 'approved' : status === 'На перевірці' ? 'pending' : status === 'Відхилено' ? 'rejected' : status;
  switch (s) {
    case 'approved': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'pending': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'rejected': return 'text-red-400 bg-red-400/10 border-red-400/20';
    default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  }
}

const ACT_STATUS_LABELS: Record<string, string> = {
  approved: 'Підтверджено',
  pending: 'На перевірці',
  rejected: 'Відхилено',
};

export function actStatusLabel(status: string): string {
  return ACT_STATUS_LABELS[status] ?? status;
}

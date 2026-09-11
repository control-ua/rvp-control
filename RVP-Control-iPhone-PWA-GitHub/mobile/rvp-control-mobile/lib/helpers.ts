import type { ApplicationStatus, PayoutStatus } from '@/types';

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
  return STATUS_ALIASES[raw.toLowerCase()] ?? (raw as ApplicationStatus);
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

export function formatCurrency(amount: number): string {
  return amount.toLocaleString('uk-UA') + ' ₴';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('uk-UA', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function isOverdue(deadline?: string): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'щойно';
  if (mins < 60) return `${mins} хв тому`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} год тому`;
  const days = Math.floor(hours / 24);
  return `${days} дн тому`;
}

export const theme = {
  bg: '#0a0b0f',
  bgCard: '#15171f',
  bgCardElevated: '#1a1d28',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(59,130,246,0.3)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  critical: '#ef4444',
  info: '#3b82f6',
};

export const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  'Нова': { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', border: 'rgba(59,130,246,0.2)' },
  'Прийнята': { bg: 'rgba(139,92,246,0.1)', text: '#a78bfa', border: 'rgba(139,92,246,0.2)' },
  'В роботі': { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', border: 'rgba(245,158,11,0.2)' },
  'Виконана': { bg: 'rgba(34,197,94,0.1)', text: '#4ade80', border: 'rgba(34,197,94,0.2)' },
  'Скасована': { bg: 'rgba(239,68,68,0.1)', text: '#f87171', border: 'rgba(239,68,68,0.2)' },
};

export const severityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.1)', text: '#f87171' },
  warning: { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24' },
  info: { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa' },
};

export const payoutColors: Record<string, { bg: string; text: string }> = {
  'Очікує': { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24' },
  'Виплачено': { bg: 'rgba(34,197,94,0.1)', text: '#4ade80' },
};

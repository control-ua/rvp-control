import { supabase } from '@/lib/supabase';
import type { AutomationRule } from '@/types';

interface RuleRow {
  id: string;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
}

const DEFAULT_RULES: Omit<AutomationRule, 'triggerCount'>[] = [
  {
    id: 'no_contractor_30min',
    code: 'no_contractor_30min',
    name: 'Заявка без підрядника >30 хв',
    description: 'Нагадати, якщо нова заявка понад 30 хвилин без підрядника',
    enabled: true,
  },
  {
    id: 'deadline_tomorrow',
    code: 'deadline_tomorrow',
    name: 'Дедлайн протягом 24 год',
    description: 'Попередити, коли до дедлайну залишиться приблизно 24 години',
    enabled: true,
  },
  {
    id: 'overdue',
    code: 'overdue',
    name: 'Заявка прострочена',
    description: 'Сповістити одразу після переходу заявки в прострочені',
    enabled: true,
  },
  {
    id: 'stale_in_progress_48h',
    code: 'stale_in_progress_48h',
    name: 'Без змін у роботі >48 год',
    description: 'Нагадати, якщо заявка в роботі понад 48 годин без оновлень',
    enabled: true,
  },
  {
    id: 'contractor_problem',
    code: 'contractor_problem',
    name: 'Проблема по заявці',
    description: 'Сповіщати менеджерів, коли у заявки з’являється проблема',
    enabled: true,
  },
  {
    id: 'act_long_pending',
    code: 'act_long_pending',
    name: 'Акт на перевірці >24 год',
    description: 'Нагадати про акт, який очікує перевірки понад 24 години',
    enabled: true,
  },
  {
    id: 'payout_long_pending',
    code: 'payout_long_pending',
    name: 'Виплата очікує >48 год',
    description: 'Нагадати про виплату, що очікує понад 48 годин',
    enabled: true,
  },
];

export async function fetchAutomationRules(): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('id, code, name, description, enabled')
    .not('code', 'in', '("no_contractor_15min","deadline_1h")')
    .order('code', { ascending: true });

  if (error || !data || data.length === 0) {
    return DEFAULT_RULES.map((rule) => ({ ...rule, triggerCount: 0 }));
  }

  return (data as unknown as RuleRow[]).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    triggerCount: 0,
  }));
}

export async function toggleAutomationRule(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('automation_rules')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Не вдалося оновити правило: ${error.message}`);
}

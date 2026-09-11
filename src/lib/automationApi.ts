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
  { id: 'no_contractor_15min', code: 'no_contractor_15min', name: 'Заявка без підрядника >15 хв', description: 'Нова заявка без призначеного підрядника понад 15 хвилин', enabled: true },
  { id: 'deadline_1h', code: 'deadline_1h', name: 'Дедлайн <1 год', description: 'До дедлайну залишилося менше години', enabled: true },
  { id: 'overdue', code: 'overdue', name: 'Заявка прострочена', description: 'Дедлайн минув, заявка не виконана', enabled: true },
  { id: 'contractor_problem', code: 'contractor_problem', name: 'Підрядник повідомив problem', description: 'Підрядник повідомив про проблему', enabled: true },
  { id: 'act_long_pending', code: 'act_long_pending', name: 'Акт довго на перевірці', description: 'Акт очікує перевірки понад 24 години', enabled: true },
  { id: 'payout_long_pending', code: 'payout_long_pending', name: 'Виплата довго очікує', description: 'Виплата очікує оплати понад 48 годин', enabled: true },
];

export async function fetchAutomationRules(): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('id, code, name, description, enabled')
    .order('code', { ascending: true });

  if (error || !data || data.length === 0) {
    return DEFAULT_RULES.map(r => ({ ...r, triggerCount: 0 }));
  }

  return (data as unknown as RuleRow[]).map(row => ({
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
    .update({ enabled })
    .eq('id', id);

  if (error) throw new Error(`Не вдалося оновити правило: ${error.message}`);
}

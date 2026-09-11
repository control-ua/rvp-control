import { useCallback, useEffect, useState } from 'react';
import { Zap, RefreshCw, Loader2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { fetchAutomationRules, toggleAutomationRule } from '@/lib/automationApi';
import { useApp } from '@/context/AppContext';
import { tryCreateAuditLog } from '@/lib/auditLogApi';
import type { AutomationRule } from '@/types';

export default function AutomationRules() {
  const { showToast } = useApp();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAutomationRules();
      setRules(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (rule: AutomationRule) => {
    setToggling(rule.id);
    try {
      await toggleAutomationRule(rule.id, !rule.enabled);
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
      await tryCreateAuditLog({
        action: 'automation_rule_changed',
        entityType: 'system',
        entityId: rule.id,
        title: `Правило ${rule.enabled ? 'вимкнено' : 'увімкнено'}`,
        description: rule.name,
        metadata: { rule_code: rule.code, enabled: !rule.enabled },
      });
      showToast(`Правило ${rule.enabled ? 'вимкнено' : 'увімкнено'}`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Помилка', 'error');
    } finally {
      setToggling(null);
    }
  };

  return (
    <PageHeader
      pageTitle="Автоматизація"
      pageSubtitle="Автоматичні правила контролю"
      actions={
        <button onClick={load} disabled={loading} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Оновити
        </button>
      }
    >
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#141821]">
        {loading ? (
          <div className="py-14 text-center"><Loader2 size={20} className="mx-auto animate-spin text-slate-500" /></div>
        ) : (
          <div className="divide-y divide-white/5">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center gap-4 px-5 py-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${rule.enabled ? 'bg-blue-500/10 text-blue-400' : 'bg-white/5 text-slate-500'}`}>
                  <Zap size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200">{rule.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
                </div>
                <button
                  onClick={() => handleToggle(rule)}
                  disabled={toggling === rule.id}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${rule.enabled ? 'bg-blue-600' : 'bg-white/10'} disabled:opacity-50`}
                >
                  <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${rule.enabled ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageHeader>
  );
}

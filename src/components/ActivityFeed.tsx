import { useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchActivityFeed } from '@/lib/activityFeedApi';
import { formatDateTime } from '@/utils/helpers';
import type { ActivityFeedItem } from '@/types';

const typeStyles: Record<string, { icon: string; color: string }> = {
  application_created: { icon: '📝', color: 'text-blue-400' },
  contractor_assigned: { icon: '👤', color: 'text-emerald-400' },
  contractor_departed: { icon: '🚗', color: 'text-cyan-400' },
  work_started: { icon: '🔧', color: 'text-amber-400' },
  problem: { icon: '⚠️', color: 'text-red-400' },
  act_uploaded: { icon: '📋', color: 'text-violet-400' },
  act_reviewed: { icon: '✅', color: 'text-emerald-400' },
  application_completed: { icon: '🎉', color: 'text-emerald-400' },
  payout_created: { icon: '💰', color: 'text-amber-400' },
  payout_paid: { icon: '✅', color: 'text-emerald-400' },
};

interface Props {
  onViewAll?: () => void;
}

export default function ActivityFeed({ onViewAll }: Props) {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await fetchActivityFeed(10);
        if (mounted) setItems(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'acts' }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#141821] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity size={16} className="text-blue-400" /> Онлайн-стрічка
        </h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-xs text-blue-400 hover:text-blue-300">Вся історія</button>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center"><Loader2 size={18} className="mx-auto animate-spin text-slate-500" /></div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center"><p className="text-sm text-slate-500">Подій поки немає</p></div>
      ) : (
        <div className="space-y-1">
          {items.map(item => {
            const style = typeStyles[item.type] ?? { icon: '•', color: 'text-slate-400' };
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-white/[0.02]">
                <span className="text-sm">{style.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${style.color}`}>{item.title}</p>
                  {item.description && <p className="truncate text-xs text-slate-500">{item.description}</p>}
                </div>
                <span className="shrink-0 text-[10px] text-slate-600">{formatDateTime(item.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

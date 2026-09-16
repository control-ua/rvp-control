import { useState } from 'react';
import {
  Bell,
  FileText,
  Menu,
  Users,
  X,
  ClipboardCheck,
  Wallet,
  BarChart3,
  TriangleAlert,
  MapPinned,
  ShieldCheck,
  History,
  Settings,
  LogOut,
  CalendarCheck2,
  Zap,
  LayoutDashboard,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { PageId } from '@/lib/permissions';

interface Props {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenMore?: () => void;
}

const mainItems = [
  { id: 'today' as PageId, label: 'Сьогодні', icon: CalendarCheck2 },
  { id: 'applications' as PageId, label: 'Заявки', icon: FileText },
  { id: 'contractors' as PageId, label: 'Підрядники', icon: Users },
  { id: 'notifications' as PageId, label: 'Сповіщення', icon: Bell },
];

const moreItems = [
  { id: 'dashboard' as PageId, label: 'Головна', icon: LayoutDashboard },
  { id: 'acts' as PageId, label: 'Акти', icon: ClipboardCheck },
  { id: 'problems' as PageId, label: 'Проблеми', icon: TriangleAlert },
  { id: 'object-map' as PageId, label: 'Карта обʼєктів', icon: MapPinned },
  { id: 'payouts' as PageId, label: 'Виплати', icon: Wallet },
  { id: 'statistics' as PageId, label: 'Статистика', icon: BarChart3 },
  { id: 'automation' as PageId, label: 'Автоматизація', icon: Zap },
  { id: 'administrators' as PageId, label: 'Адміністратори', icon: ShieldCheck },
  { id: 'audit-log' as PageId, label: 'Журнал дій', icon: History },
  { id: 'settings' as PageId, label: 'Налаштування', icon: Settings },
];

export default function MobileNav({ currentPage, onNavigate }: Props) {
  const [open, setOpen] = useState(false);

  const go = (page: PageId) => {
    setOpen(false);
    onNavigate(page);
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            aria-label="Закрити меню"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          <div className="absolute bottom-[calc(70px+env(safe-area-inset-bottom))] left-2 right-2 max-h-[72dvh] overflow-y-auto rounded-3xl border border-white/10 bg-[#121720] p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <div>
                <p className="text-sm font-semibold text-white">RVP Control</p>
                <p className="text-[11px] text-slate-500">Усі розділи</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {moreItems.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className={`flex min-h-[62px] items-center gap-3 rounded-xl border px-3 py-3 text-left ${
                    currentPage === id
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                      : 'border-white/5 bg-white/[0.02] text-slate-400'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.06] py-3 text-sm text-red-400"
            >
              <LogOut size={16} /> Вийти
            </button>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 z-[80] border-t border-white/10 bg-[#0f131a]/95 px-1 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex h-16 max-w-xl">
          {mainItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
                currentPage === id ? 'text-blue-400' : 'text-slate-500'
              }`}
            >
              {currentPage === id && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-blue-500" />
              )}
              <Icon size={19} />
              <span className="max-w-full truncate px-1">{label}</span>
            </button>
          ))}

          <button
            onClick={() => setOpen((value) => !value)}
            className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
              open ? 'text-blue-400' : 'text-slate-500'
            }`}
          >
            {open && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-blue-500" />}
            <Menu size={19} />
            <span>Ще</span>
          </button>
        </div>
      </nav>
    </>
  );
}

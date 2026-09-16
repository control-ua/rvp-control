import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  Wallet,
  BarChart2,
  ChevronRight,
  Settings,
  Bell,
  LogOut,
  ShieldCheck,
  History,
  TriangleAlert,
  MapPinned,
  CalendarCheck2,
  Zap,
} from 'lucide-react';

import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import type { PageId } from '@/lib/permissions';

interface Props {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenSearch?: () => void;
}

const navItems: {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'today', label: 'Сьогодні', icon: CalendarCheck2 },
  { id: 'dashboard', label: 'Головна', icon: LayoutDashboard },
  { id: 'applications', label: 'Заявки', icon: FileText },
  { id: 'contractors', label: 'Підрядники', icon: Users },
  { id: 'acts', label: 'Акти', icon: ClipboardList },
  { id: 'problems', label: 'Проблемні заявки', icon: TriangleAlert },
  { id: 'object-map', label: 'Карта обʼєктів', icon: MapPinned },
  { id: 'payouts', label: 'Виплати', icon: Wallet },
  { id: 'statistics', label: 'Статистика', icon: BarChart2 },
  { id: 'automation', label: 'Автоматизація', icon: Zap },
  { id: 'administrators', label: 'Адміністратори', icon: ShieldCheck },
  { id: 'audit-log', label: 'Журнал дій', icon: History },
];

export default function Sidebar({ currentPage, onNavigate }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { showToast } = useApp();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error(error);
      showToast('Не вдалося вийти з аккаунта', 'error');
    }
  };

  const navButton = (
    id: PageId,
    label: string,
    Icon: typeof LayoutDashboard,
  ) => {
    const active = currentPage === id;

    return (
      <button
        key={id}
        onClick={() => onNavigate(id)}
        title={collapsed ? label : undefined}
        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
          active
            ? 'bg-blue-600/15 text-blue-400'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        }`}
      >
        <Icon
          size={18}
          className={`shrink-0 ${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`}
        />
        {!collapsed && <span>{label}</span>}
        {active && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400" />}
      </button>
    );
  };

  return (
    <aside className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-white/5 bg-[#0f1117] transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600">
          <span className="text-sm font-bold text-white">R</span>
        </div>
        {!collapsed && <span className="text-[15px] font-semibold tracking-tight text-white">RVP Admin</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-slate-500 transition-colors hover:text-slate-300"
          title={collapsed ? 'Розгорнути меню' : 'Згорнути меню'}
        >
          <ChevronRight size={16} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        {navItems.map(({ id, label, icon }) => navButton(id, label, icon))}
      </nav>

      <div className="space-y-0.5 border-t border-white/5 p-2">
        {navButton('notifications', 'Сповіщення', Bell)}
        {navButton('settings', 'Налаштування', Settings)}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-all hover:bg-red-400/5 hover:text-red-400"
          title={collapsed ? 'Вийти' : undefined}
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Вийти</span>}
        </button>
      </div>
    </aside>
  );
}

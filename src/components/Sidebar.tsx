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
} from 'lucide-react';

import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';

type Page =
  | 'dashboard'
  | 'applications'
  | 'contractors'
  | 'acts'
  | 'payouts'
  | 'statistics'
  | 'administrators'
  | 'audit-log'
  | 'notifications'
  | 'settings'
  | 'problems'
  | 'object-map';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: {
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', label: 'Головна', icon: LayoutDashboard },
  { id: 'applications', label: 'Заявки', icon: FileText },
  { id: 'contractors', label: 'Підрядники', icon: Users },
  { id: 'acts', label: 'Акти', icon: ClipboardList },
  { id: 'problems', label: 'Проблемні заявки', icon: TriangleAlert },
  { id: 'object-map', label: 'Карта обʼєктів', icon: MapPinned },
  { id: 'payouts', label: 'Виплати', icon: Wallet },
  { id: 'statistics', label: 'Статистика', icon: BarChart2 },
  { id: 'administrators', label: 'Адміністратори', icon: ShieldCheck },
  { id: 'audit-log', label: 'Журнал дій', icon: History },
];

export default function Sidebar({
  currentPage,
  onNavigate,
}: Props) {
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
    id: Page,
    label: string,
    Icon: typeof LayoutDashboard
  ) => {
    const active = currentPage === id;

    return (
      <button
        key={id}
        onClick={() => onNavigate(id)}
        title={collapsed ? label : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
          active
            ? 'bg-blue-600/15 text-blue-400'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
        <Icon
          size={18}
          className={`shrink-0 ${
            active
              ? 'text-blue-400'
              : 'text-slate-500 group-hover:text-slate-300'
          }`}
        />

        {!collapsed && <span>{label}</span>}

        {active && !collapsed && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" />
        )}
      </button>
    );
  };

  return (
    <aside
      className={`flex flex-col bg-[#0f1117] border-r border-white/5 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      } shrink-0 h-screen sticky top-0`}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">R</span>
        </div>

        {!collapsed && (
          <span className="font-semibold text-white tracking-tight text-[15px]">
            RVP Admin
          </span>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          title={collapsed ? 'Розгорнути меню' : 'Згорнути меню'}
        >
          <ChevronRight
            size={16}
            className={`transition-transform ${
              collapsed ? '' : 'rotate-180'
            }`}
          />
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ id, label, icon }) =>
          navButton(id, label, icon)
        )}
      </nav>

      <div className="border-t border-white/5 p-2 space-y-0.5">
        {navButton('notifications', 'Сповіщення', Bell)}
        {navButton('settings', 'Налаштування', Settings)}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-400/5 transition-all"
          title={collapsed ? 'Вийти' : undefined}
        >
          <LogOut size={18} className="shrink-0" />

          {!collapsed && <span>Вийти</span>}
        </button>
      </div>
    </aside>
  );
}

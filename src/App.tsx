import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Bell, LogOut, Search } from 'lucide-react';

import { AppProvider } from '@/context/AppContext';
import ToastContainer from '@/components/ToastContainer';
import Sidebar from '@/components/Sidebar';
import GlobalSearchOverlay from '@/components/GlobalSearchOverlay';
import MobileNav from '@/components/MobileNav';

import Dashboard from '@/pages/Dashboard';
import Applications from '@/pages/Applications';
import Contractors from '@/pages/Contractors';
import Acts from '@/pages/Acts';
import Payouts from '@/pages/Payouts';
import Statistics from '@/pages/Statistics';
import Administrators from '@/pages/Administrators';
import AuditLog from '@/pages/AuditLog';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';
import Problems from '@/pages/Problems';
import ObjectMap from '@/pages/ObjectMap';
import ControlCenter from '@/pages/ControlCenter';
import ContractorRating from '@/pages/ContractorRating';
import Calendar from '@/pages/Calendar';
import Finance from '@/pages/Finance';
import AutomationRules from '@/pages/AutomationRules';
import Archive from '@/pages/Archive';
import Login from '@/pages/Login';

import { supabase } from '@/lib/supabase';
import type { PageId } from '@/lib/permissions';

type ApplicationDashboardFilter =
  | 'all'
  | 'new'
  | 'accepted'
  | 'work'
  | 'done'
  | 'overdue'
  | 'today'
  | 'tomorrow';

type NewApplicationNotification = {
  id: string;
  number: string;
  object: string;
  address: string;
};

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [searchOpen, setSearchOpen] = useState(false);
  const [applicationFilter, setApplicationFilter] = useState<ApplicationDashboardFilter>('all');
  const [newApplication, setNewApplication] = useState<NewApplicationNotification | null>(null);
  const [unreadApplications, setUnreadApplications] = useState(0);
  const notificationTimer = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(value => !value);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(740, ctx.currentTime);
      oscillator.frequency.setValueAtTime(940, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.4);
    } catch (error) {
      console.log('Sound error:', error);
    }
  };

  const showBrowserNotification = (application: NewApplicationNotification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const notification = new Notification(`Нова заявка ${application.number}`, {
        body: application.object + (application.address ? `\n${application.address}` : ''),
      });
      notification.onclick = () => {
        window.focus();
        setApplicationFilter('all');
        setCurrentPage('applications');
        notification.close();
      };
    } catch (error) {
      console.log('Notifications unavailable:', error);
    }
  };

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('applications-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'applications' }, payload => {
        const row = payload.new as Record<string, any>;
        const application: NewApplicationNotification = {
          id: String(row.id ?? ''),
          number: String(row.application_number || row.number || row.code || 'Нова'),
          object: String(row.title || row.object_name || row.object || row.station_name || 'Новий обʼєкт'),
          address: String(row.address || row.object_address || row.location || ''),
        };

        setNewApplication(application);
        setUnreadApplications(prev => prev + 1);
        playNotificationSound();
        showBrowserNotification(application);

        if (notificationTimer.current) window.clearTimeout(notificationTimer.current);
        notificationTimer.current = window.setTimeout(() => setNewApplication(null), 15000);
      })
      .subscribe();

    return () => {
      if (notificationTimer.current) window.clearTimeout(notificationTimer.current);
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navigateTo = (page: PageId, filter: ApplicationDashboardFilter = 'all') => {
    if (page === 'applications') {
      setApplicationFilter(filter);
      setUnreadApplications(0);
    }
    setCurrentPage(page);
    if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openApplications = () => {
    navigateTo('applications', 'all');
    setNewApplication(null);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={navigateTo} />;
      case 'applications': return <Applications dashboardFilter={applicationFilter} onDashboardFilterChange={setApplicationFilter} />;
      case 'contractors': return <Contractors />;
      case 'acts': return <Acts />;
      case 'payouts': return <Payouts />;
      case 'statistics': return <Statistics />;
      case 'administrators': return <Administrators />;
      case 'audit-log': return <AuditLog />;
      case 'notifications': return <Notifications onNavigateToApplications={() => navigateTo('applications')} onNavigateToActs={() => navigateTo('acts')} onNavigateToPayouts={() => navigateTo('payouts')} />;
      case 'settings': return <Settings />;
      case 'problems': return <Problems onNavigateToApplications={() => navigateTo('applications')} />;
      case 'object-map': return <ObjectMap />;
      case 'control-center': return <ControlCenter onNavigateToApplication={() => navigateTo('applications')} />;
      case 'contractor-rating': return <ContractorRating />;
      case 'calendar': return <Calendar onNavigateToApplications={() => navigateTo('applications')} />;
      case 'finance': return <Finance onNavigateToPayouts={() => navigateTo('payouts')} />;
      case 'automation': return <AutomationRules />;
      case 'archive': return <Archive onNavigateToApplications={() => navigateTo('applications')} />;
      default: return <Dashboard onNavigate={navigateTo} />;
    }
  };

  if (authLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-[#0d0f14]"><div className="text-sm text-slate-400">Завантаження...</div></div>;
  }

  if (!session) return <Login />;

  return (
    <AppProvider>
      <div className="min-h-[100dvh] bg-[#060b12] text-slate-100 lg:flex">
        <div className="hidden lg:block">
          <Sidebar
            currentPage={currentPage}
            onNavigate={navigateTo}
            onOpenSearch={() => setSearchOpen(true)}
          />
        </div>

        <div className="min-w-0 w-full flex-1">
          <header className="sticky top-0 z-40 flex h-[62px] items-center justify-between border-b border-white/[0.06] bg-[#07101a]/90 px-4 backdrop-blur-xl sm:px-5 lg:h-14 lg:px-6">
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 text-sm font-black text-white shadow-[0_0_24px_rgba(59,130,246,0.30)]">R</div>
              <div className="min-w-0"><p className="truncate text-[15px] font-bold tracking-tight text-white">RVP Control</p><p className="truncate text-[10px] font-medium tracking-wide text-slate-500">CONTROL CENTER</p></div>
            </div>
            <div className="hidden lg:block" />

            <div className="flex items-center gap-2">
              <button onClick={() => setSearchOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-slate-400 transition hover:bg-white/[0.06] hover:text-white sm:w-auto sm:px-3" aria-label="Пошук">
                <Search size={16} /><span className="ml-2 hidden sm:inline">Пошук</span>
              </button>

              <button onClick={() => navigateTo('notifications')} className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.025] text-slate-400 transition hover:bg-white/[0.06] hover:text-white" aria-label="Сповіщення">
                <Bell size={16} />
                {unreadApplications > 0 && <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unreadApplications > 99 ? '99+' : unreadApplications}</span>}
              </button>

              <div className="hidden max-w-[220px] text-right md:block"><p className="truncate text-xs text-slate-500">Адміністратор</p><p className="truncate text-sm text-slate-300">{session.user.email}</p></div>

              <button onClick={handleLogout} className="hidden h-9 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 text-sm text-slate-400 transition hover:bg-red-500/10 hover:text-red-400 md:flex"><LogOut size={15} />Вийти</button>
            </div>
          </header>

          <main className="min-w-0 pb-[calc(76px+env(safe-area-inset-bottom))] lg:pb-0">{renderPage()}</main>
        </div>

        <MobileNav currentPage={currentPage} onNavigate={navigateTo} onOpenMore={() => navigateTo('settings')} />

        {searchOpen && <GlobalSearchOverlay onClose={() => setSearchOpen(false)} onNavigate={page => { setSearchOpen(false); navigateTo(page as PageId); }} />}

        {newApplication && (
          <div className="fixed left-3 right-3 top-[74px] z-[9999] overflow-hidden rounded-[22px] border border-cyan-400/20 bg-[#0b1622]/95 shadow-[0_24px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[390px]">
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400" />
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-xl">🔔</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">Нова заявка</p>
                  <p className="mt-1 text-lg font-bold text-cyan-400">{newApplication.number}</p>
                  <p className="mt-1 truncate text-white">{newApplication.object}</p>
                  {newApplication.address && <p className="mt-1 line-clamp-2 text-sm text-slate-400">📍 {newApplication.address}</p>}
                </div>
                <button onClick={() => setNewApplication(null)} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-white/5 hover:text-white">✕</button>
              </div>
              <button onClick={openApplications} className="mt-4 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-[#061018] transition hover:bg-cyan-400">Відкрити заявки</button>
            </div>
          </div>
        )}
      </div>

      <ToastContainer />
    </AppProvider>
  );
}

export default App;

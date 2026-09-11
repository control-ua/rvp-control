import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { AppProvider } from '@/context/AppContext';
import ToastContainer from '@/components/ToastContainer';
import Sidebar from '@/components/Sidebar';
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
import Login from '@/pages/Login';

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

type NewApplicationNotification = {
  id: string;
  number: string;
  object: string;
  address: string;
};

function App() {
  const [session, setSession] =
    useState<Session | null>(
      null
    );

  const [
    authLoading,
    setAuthLoading,
  ] = useState(true);

  const [
    currentPage,
    setCurrentPage,
  ] =
    useState<Page>(
      'dashboard'
    );

  const [
    newApplication,
    setNewApplication,
  ] =
    useState<NewApplicationNotification | null>(
      null
    );

  const [
    unreadApplications,
    setUnreadApplications,
  ] = useState(0);

  const notificationTimer =
    useRef<number | null>(
      null
    );

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(
          data.session
        );
        setAuthLoading(
          false
        );
      });

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          newSession
        ) => {
          setSession(
            newSession
          );
          setAuthLoading(
            false
          );
        }
      );

    return () =>
      subscription.unsubscribe();
  }, []);

  const playNotificationSound =
    () => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (
            window as any
          ).webkitAudioContext;

        if (
          !AudioContextClass
        ) {
          return;
        }

        const ctx =
          new AudioContextClass();

        const oscillator =
          ctx.createOscillator();

        const gain =
          ctx.createGain();

        oscillator.connect(
          gain
        );

        gain.connect(
          ctx.destination
        );

        oscillator.type =
          'sine';

        oscillator.frequency.setValueAtTime(
          740,
          ctx.currentTime
        );

        oscillator.frequency.setValueAtTime(
          940,
          ctx.currentTime +
            0.12
        );

        gain.gain.setValueAtTime(
          0.0001,
          ctx.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
          0.18,
          ctx.currentTime +
            0.02
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime +
            0.35
        );

        oscillator.start();

        oscillator.stop(
          ctx.currentTime +
            0.4
        );
      } catch (error) {
        console.log(
          'Sound error:',
          error
        );
      }
    };

  const showBrowserNotification =
    (
      application: NewApplicationNotification
    ) => {
      if (
        !(
          'Notification' in
          window
        )
      ) {
        return;
      }

      if (
        Notification.permission !==
        'granted'
      ) {
        return;
      }

      try {
        const notification =
          new Notification(
            `Нова заявка ${application.number}`,
            {
              body:
                application.object +
                (application.address
                  ? `\n${application.address}`
                  : ''),
            }
          );

        notification.onclick =
          () => {
            window.focus();

            setCurrentPage(
              'applications'
            );

            notification.close();
          };
      } catch (error) {
        console.log(
          'Notifications unavailable:',
          error
        );
      }
    };

  useEffect(() => {
    if (!session) {
      return;
    }

    const channel =
      supabase
        .channel(
          'applications-notifications'
        )
        .on(
          'postgres_changes',
          {
            event:
              'INSERT',
            schema:
              'public',
            table:
              'applications',
          },
          (payload) => {
            const row =
              payload.new as Record<
                string,
                any
              >;

            const application: NewApplicationNotification =
              {
                id: String(
                  row.id ??
                    ''
                ),

                number:
                  String(
                    row.application_number ||
                      row.number ||
                      row.code ||
                      'Нова'
                  ),

                object:
                  String(
                    row.title ||
                      row.object_name ||
                      row.object ||
                      row.station_name ||
                      'Новий обʼєкт'
                  ),

                address:
                  String(
                    row.address ||
                      row.object_address ||
                      row.location ||
                      ''
                  ),
              };

            setNewApplication(
              application
            );

            setUnreadApplications(
              (prev) =>
                prev + 1
            );

            playNotificationSound();

            showBrowserNotification(
              application
            );

            if (
              notificationTimer.current
            ) {
              window.clearTimeout(
                notificationTimer.current
              );
            }

            notificationTimer.current =
              window.setTimeout(
                () => {
                  setNewApplication(
                    null
                  );
                },
                15000
              );
          }
        )
        .subscribe();

    return () => {
      if (
        notificationTimer.current
      ) {
        window.clearTimeout(
          notificationTimer.current
        );
      }

      supabase.removeChannel(
        channel
      );
    };
  }, [session]);

  const handleLogout =
    async () => {
      await supabase.auth.signOut();
    };

  const navigateTo = (
    page: Page
  ) => {
    setCurrentPage(
      page
    );

    if (
      page ===
      'applications'
    ) {
      setUnreadApplications(
        0
      );
    }
  };

  const openApplications =
    () => {
      navigateTo(
        'applications'
      );

      setNewApplication(
        null
      );
    };

  const renderPage =
    () => {
      switch (
        currentPage
      ) {
        case 'dashboard':
          return (
            <Dashboard
              onNavigate={
                navigateTo
              }
            />
          );

        case 'applications':
          return (
            <Applications />
          );

        case 'contractors':
          return (
            <Contractors />
          );

        case 'acts':
          return <Acts />;

        case 'payouts':
          return (
            <Payouts />
          );

        case 'statistics':
          return (
            <Statistics />
          );

        case 'administrators':
          return (
            <Administrators />
          );

        case 'audit-log':
          return (
            <AuditLog />
          );

        case 'notifications':
          return (
            <Notifications />
          );

        case 'settings':
          return (
            <Settings />
          );

        case 'problems':
          return <Problems />;

        case 'object-map':
          return <ObjectMap />;

        default:
          return (
            <Dashboard
              onNavigate={
                navigateTo
              }
            />
          );
      }
    };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0f14]">
        <div className="text-gray-400">
          Завантаження...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <AppProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-[#0d0f14]">
        <div className="hidden lg:block">
        <Sidebar
          currentPage={
            currentPage
          }
          onNavigate={(
            page
          ) =>
            navigateTo(
              page as Page
            )
          }
        />
        </div>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="sticky top-0 z-40 flex min-h-14 items-center justify-end border-b border-white/5 bg-[#0d0f14]/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:px-6 lg:pt-0">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  Адміністратор
                </p>

                <p className="text-sm text-gray-300">
                  {
                    session
                      .user
                      .email
                  }
                </p>
              </div>

              <button
                onClick={
                  handleLogout
                }
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 transition hover:bg-red-500/10 hover:text-red-400"
              >
                Вийти
              </button>
            </div>
          </div>

          {renderPage()}
        </div>

        {newApplication && (
          <div className="fixed right-6 top-20 z-[9999] w-[390px] overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#101722] shadow-2xl">
            <div className="h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400" />

            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-2xl">
                  🔔
                </div>

                <div className="flex-1">
                  <p className="font-semibold text-white">
                    Нова заявка
                  </p>

                  <p className="mt-1 text-lg font-bold text-cyan-400">
                    {
                      newApplication.number
                    }
                  </p>

                  <p className="mt-1 text-white">
                    {
                      newApplication.object
                    }
                  </p>

                  {newApplication.address && (
                    <p className="mt-1 text-sm text-gray-400">
                      📍{' '}
                      {
                        newApplication.address
                      }
                    </p>
                  )}
                </div>

                <button
                  onClick={() =>
                    setNewApplication(
                      null
                    )
                  }
                  className="text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <button
                onClick={
                  openApplications
                }
                className="mt-4 w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-[#061018] transition hover:bg-cyan-400"
              >
                Відкрити заявки
              </button>
            </div>
          </div>
        )}

        {unreadApplications >
          0 &&
          !newApplication && (
            <button
              onClick={
                openApplications
              }
              className="fixed right-6 top-20 z-[9998] rounded-full bg-red-500 px-3 py-2 text-sm font-bold text-white shadow-xl"
            >
              🔔{' '}
              {
                unreadApplications
              }
            </button>
          )}
        <MobileNav currentPage={currentPage} onNavigate={navigateTo} />
      </main>

      <ToastContainer />
    </AppProvider>
  );
}

export default App;

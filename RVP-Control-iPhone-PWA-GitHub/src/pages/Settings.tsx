import { useEffect, useState } from 'react';
import {
  Bell,
  Monitor,
  Save,
  Settings as SettingsIcon,
  Volume2,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';

const STORAGE_KEY = 'rvp-control-settings';

type LocalSettings = {
  browserNotifications: boolean;
  sound: boolean;
  compactTables: boolean;
  autoRefresh: boolean;
};

const defaults: LocalSettings = {
  browserNotifications: true,
  sound: true,
  compactTables: false,
  autoRefresh: true,
};

export default function Settings() {
  const { showToast } = useApp();
  const [settings, setSettings] = useState<LocalSettings>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings({
          ...defaults,
          ...JSON.parse(raw),
        });
      }
    } catch {
      setSettings(defaults);
    }
  }, []);

  const toggle = (key: keyof LocalSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const save = async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );

    if (
      settings.browserNotifications &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore
      }
    }

    showToast('Налаштування збережено', 'success');
  };

  const rows: Array<{
    key: keyof LocalSettings;
    title: string;
    description: string;
    icon: typeof Bell;
  }> = [
    {
      key: 'browserNotifications',
      title: 'Сповіщення у браузері',
      description: 'Показувати системне сповіщення при новій заявці.',
      icon: Bell,
    },
    {
      key: 'sound',
      title: 'Звукові сповіщення',
      description: 'Відтворювати короткий сигнал при новій події.',
      icon: Volume2,
    },
    {
      key: 'compactTables',
      title: 'Компактні таблиці',
      description: 'Зменшити висоту рядків у великих списках.',
      icon: Monitor,
    },
    {
      key: 'autoRefresh',
      title: 'Автоматичне оновлення',
      description: 'Автоматично оновлювати дані під час роботи.',
      icon: SettingsIcon,
    },
  ];

  return (
    <PageHeader
      pageTitle="Налаштування"
      pageSubtitle="Параметри RVP Control"
      actions={
        <button
          onClick={save}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Save size={15} />
          Зберегти
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#141821]">
          <div className="border-b border-white/5 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">
              Інтерфейс та сповіщення
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Налаштування зберігаються у цьому браузері.
            </p>
          </div>

          {rows.map(({ key, title, description, icon: Icon }) => (
            <div
              key={key}
              className="flex items-center gap-4 border-b border-white/5 px-5 py-4 last:border-b-0"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Icon size={17} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-200">
                  {title}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {description}
                </p>
              </div>

              <button
                onClick={() => toggle(key)}
                className={`relative h-6 w-11 rounded-full transition ${
                  settings[key]
                    ? 'bg-blue-600'
                    : 'bg-white/10'
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                    settings[key]
                      ? 'left-6'
                      : 'left-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/5 bg-[#141821] p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Система
          </p>

          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Назва</p>
              <p className="mt-1 text-slate-200">RVP Control</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Режим</p>
              <p className="mt-1 text-emerald-400">Online</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Авторизація</p>
              <p className="mt-1 text-slate-200">Supabase Auth</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Realtime</p>
              <p className="mt-1 text-slate-200">Supabase Realtime</p>
            </div>
          </div>
        </div>
      </div>
    </PageHeader>
  );
}

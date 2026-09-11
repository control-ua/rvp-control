import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Toast } from '@/context/AppContext';

const config: Record<Toast['type'], { icon: React.ReactNode; accent: string }> = {
  success: {
    icon: <CheckCircle size={18} className="text-emerald-400" />,
    accent: 'border-l-emerald-400',
  },
  error: {
    icon: <AlertCircle size={18} className="text-red-400" />,
    accent: 'border-l-red-400',
  },
  info: {
    icon: <Info size={18} className="text-blue-400" />,
    accent: 'border-l-blue-400',
  },
};

export default function ToastContainer() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-80">
      {toasts.map(toast => {
        const { icon, accent } = config[toast.type];
        return (
          <div
            key={toast.id}
            className={`bg-[#1a1f2e] border border-white/10 ${accent} border-l-2 rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 animate-[slideIn_0.2s_ease-out]`}
          >
            {icon}
            <span className="text-sm text-slate-200 flex-1">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

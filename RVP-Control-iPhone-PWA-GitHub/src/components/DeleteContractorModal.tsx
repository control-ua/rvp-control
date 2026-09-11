import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, User, Phone, MapPin, Loader2 } from 'lucide-react';
import { countContractorApplications, deleteContractor, setContractorStatus, type ContractorListItem } from '@/lib/contractorsApi';
import { useApp } from '@/context/AppContext';

interface Props {
  contractor: ContractorListItem;
  onCancel: () => void;
  onDone: () => void;
}

export default function DeleteContractorModal({ contractor, onCancel, onDone }: Props) {
  const { showToast } = useApp();
  const [checking, setChecking] = useState(true);
  const [linkedCount, setLinkedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    countContractorApplications(contractor.id)
      .then(count => {
        setLinkedCount(count);
        setChecking(false);
      })
      .catch(() => {
        setLinkedCount(0);
        setChecking(false);
      });
  }, [contractor.id]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      if (linkedCount > 0) {
        await setContractorStatus(contractor.id, 'inactive');
        showToast('Підрядника не видалено, оскільки він має історію заявок. Його деактивовано.', 'info');
      } else {
        await deleteContractor(contractor.id);
        showToast('Підрядника видалено', 'success');
      }
      onDone();
      onCancel();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка видалення підрядника';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-[#141720] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <h2 className="text-base font-semibold text-white">Видалити підрядника?</h2>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User size={15} className="text-slate-500 shrink-0" />
              <span className="text-xs text-slate-500 w-16">ПІБ</span>
              <span className="text-sm text-slate-200">{contractor.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={15} className="text-slate-500 shrink-0" />
              <span className="text-xs text-slate-500 w-16">Телефон</span>
              <span className="text-sm text-slate-200">{contractor.phone ?? '—'}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin size={15} className="text-slate-500 shrink-0" />
              <span className="text-xs text-slate-500 w-16">Регіон</span>
              <span className="text-sm text-slate-200">{contractor.regionName ?? '—'}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertTriangle size={15} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">
              {checking
                ? 'Перевірка зв\'язаних заявок...'
                : linkedCount > 0
                  ? `Підрядник має ${linkedCount} зв\'язаних заявок. Замість видалення він буде деактивований. Історичні заявки та акти не будуть пошкоджені.`
                  : 'Підрядник буде видалений. Історичні заявки та акти не повинні бути пошкоджені.'}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={handleConfirm}
            disabled={checking || submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {(checking || submitting) && <Loader2 size={15} className="animate-spin" />}
            {linkedCount > 0 ? 'Деактивувати' : 'Видалити'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

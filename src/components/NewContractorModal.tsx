import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { insertContractor, fetchRegions, type ContractorStatus, type RegionOption } from '@/lib/contractorsApi';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  phone: string;
  username: string;
  regionCode: string;
  regionName: string;
  status: ContractorStatus;
}

const empty: FormState = {
  firstName: '',
  lastName: '',
  phone: '',
  username: '',
  regionCode: '',
  regionName: '',
  status: 'active',
};

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition';

function Field({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400">
        {label}{required && <span className="text-red-400"> *</span>}
      </label>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export default function NewContractorModal({ onClose, onCreated }: Props) {
  const { showToast } = useApp();
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [regions, setRegions] = useState<RegionOption[]>([]);

  useEffect(() => {
    fetchRegions().then(setRegions).catch(() => setRegions([]));
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.firstName.trim()) e.firstName = 'Введіть ім\'я';
    if (!form.phone.trim()) e.phone = 'Введіть телефон';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await insertContractor({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        username: form.username,
        regionCode: form.regionCode,
        regionName: form.regionName,
        status: form.status,
      });
      showToast('Підрядника успішно додано', 'success');
      onCreated();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка додавання підрядника';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141720] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#141720] border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-white">Новий підрядник</h2>
            <p className="text-xs text-slate-500 mt-0.5">Додайте підрядника до бази</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ім\'я" required error={errors.firstName}>
              <input
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
                placeholder="Ім\'я"
                className={inputCls}
              />
            </Field>
            <Field label="Прізвище">
              <input
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
                placeholder="Прізвище"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Телефон" required error={errors.phone}>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+380 __ ___ __ __"
                className={inputCls}
              />
            </Field>
            <Field label="Telegram username">
              <input
                value={form.username}
                onChange={e => set('username', e.target.value)}
                placeholder="@username"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Регіон">
              <select
                value={form.regionName}
                onChange={e => {
                  const selected = regions.find(r => r.name === e.target.value);
                  setForm(prev => ({ ...prev, regionName: e.target.value, regionCode: selected?.code ?? '' }));
                }}
                className={inputCls}
              >
                <option value="">—</option>
                {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Статус">
              <select
                value={form.status}
                onChange={e => set('status', e.target.value as ContractorStatus)}
                className={inputCls}
              >
                <option value="active">Активний</option>
                <option value="inactive">Неактивний</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#141720] border-t border-white/5 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            Скасувати
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Додати підрядника
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

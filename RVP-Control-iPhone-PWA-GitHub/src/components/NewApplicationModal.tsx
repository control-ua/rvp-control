import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Hash, Loader2, Clipboard, Sparkles, Search } from 'lucide-react';
import { useApp, generateApplicationNumber } from '@/context/AppContext';
import { insertApplication, fetchApplications } from '@/lib/applicationsApi';
import { fetchActiveContractors, type ContractorListItem } from '@/lib/contractorsApi';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

interface FormState {
  customer: string;
  address: string;
  description: string;
  contractorId: string;
  deadline: string;
  azkCode: string;
  managerComment: string;
  payoutAmount: string;
}

const empty: FormState = {
  customer: '',
  address: '',
  description: '',
  contractorId: '',
  deadline: '',
  azkCode: '',
  managerComment: '',
  payoutAmount: '',
};

function Field({
  label, required, children, error,
}: {
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

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition';

function parseOrderCard(text: string): Partial<FormState> {
  const result: Partial<FormState> = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return result;

  const azsMatch = text.match(/АЗС\s*(\d+)/i) || text.match(/АЗК\s*(\d+)/i);
  if (azsMatch) result.azkCode = `АЗС ${azsMatch[1]}`;

  const dateMatch = text.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    result.deadline = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const addressLines = lines.filter(l =>
    l.toLowerCase().includes('область') ||
    l.toLowerCase().includes('р-н') ||
    l.toLowerCase().includes('вул.') ||
    l.toLowerCase().includes('с.') ||
    l.toLowerCase().includes('місто') ||
    l.toLowerCase().includes('просп.') ||
    /\d+[а]?,/.test(l)
  );
  if (addressLines.length > 0) result.address = addressLines.join(', ');

  const descMatch = text.match(/Викачка\s+(.+)/i) || text.match(/Прибиранн[я]\s+(.+)/i);
  if (descMatch) result.description = descMatch[1].trim();
  else {
    const nonMetaLines = lines.filter(l =>
      !l.toLowerCase().includes('заявка на') &&
      !l.toLowerCase().includes('азс') &&
      !l.toLowerCase().includes('азк') &&
      !l.match(/^\d{1,2}[.\/]\d{1,2}[.\/]\d{4}/) &&
      !l.toLowerCase().includes('область') &&
      !l.toLowerCase().includes('р-н')
    );
    if (nonMetaLines.length > 0 && !result.description) result.description = nonMetaLines.join(' ');
  }

  return result;
}

export default function NewApplicationModal({ onClose, onCreated }: Props) {
  const { showToast } = useApp();
  const [contractors, setContractors] = useState<ContractorListItem[]>([]);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [existingNumbers, setExistingNumbers] = useState<string[]>([]);
  const [orderCardText, setOrderCardText] = useState('');
  const [showOrderCard, setShowOrderCard] = useState(false);
  const [contractorSearch, setContractorSearch] = useState('');

  useEffect(() => {
    fetchActiveContractors().then(setContractors).catch(() => setContractors([]));
    fetchApplications().then(apps => setExistingNumbers(apps.map(a => a.number))).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const generatedNumber = useMemo(() => generateApplicationNumber(existingNumbers), [existingNumbers]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleParseOrderCard = () => {
    if (!orderCardText.trim()) {
      showToast('Вставте текст карточки заказа', 'info');
      return;
    }
    const parsed = parseOrderCard(orderCardText);
    setForm(prev => ({
      ...prev,
      azkCode: parsed.azkCode ?? prev.azkCode,
      address: parsed.address ?? prev.address,
      description: parsed.description ?? prev.description,
      deadline: parsed.deadline ?? prev.deadline,
      customer: prev.customer || (parsed.azkCode ? parsed.azkCode : ''),
    }));
    showToast('Поля заповнені з карточки заказа', 'success');
    setShowOrderCard(false);
    setOrderCardText('');
  };

  const filteredContractors = useMemo(() => {
    if (!contractorSearch.trim()) return contractors;
    const q = contractorSearch.toLowerCase().trim();
    const digits = q.replace(/\D/g, '');
    return contractors.filter(c => {
      const name = c.name.toLowerCase();
      const username = (c.username ?? '').toLowerCase();
      const phoneDigits = (c.phone ?? '').replace(/\D/g, '');
      const phoneMatch = digits.length > 0 && phoneDigits.includes(digits);
      return name.includes(q) || username.includes(q) || phoneMatch;
    });
  }, [contractors, contractorSearch]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.customer.trim()) e.customer = 'Введіть замовника';
    if (!form.address.trim()) e.address = 'Введіть адресу';
    if (!form.description.trim()) e.description = 'Опишіть роботу';
    if (!form.contractorId) e.contractorId = 'Оберіть підрядника';
    if (!form.deadline) e.deadline = 'Оберіть дедлайн';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payout = parseInt(form.payoutAmount.replace(/\D/g, ''), 10) || 0;
      await insertApplication({
        applicationNumber: generatedNumber,
        azkCode: form.azkCode.trim(),
        orderDateText: new Date().toISOString().slice(0, 10),
        title: form.customer.trim(),
        description: form.description.trim(),
        address: form.address.trim(),
        status: 'new',
        deadlineAt: form.deadline,
        managerComment: form.managerComment.trim(),
        contractorId: form.contractorId,
        payoutAmount: payout,
      });
      showToast('Заявку успішно створено', 'success');
      onCreated();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка створення заявки';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141720] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#141720] border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-base font-semibold text-white">Нова заявка</h2>
            <p className="text-xs text-slate-500 mt-0.5">Заповніть поля для створення заявки</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/20 rounded-lg px-4 py-3">
            <Hash size={16} className="text-blue-400" />
            <span className="text-xs text-slate-400">Номер заявки (авто):</span>
            <span className="font-mono text-sm text-blue-400 font-semibold">{generatedNumber}</span>
          </div>

          {/* Order card auto-parse */}
          {!showOrderCard ? (
            <button
              onClick={() => setShowOrderCard(true)}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors w-full bg-blue-500/5 border border-blue-500/10 rounded-lg px-4 py-3"
            >
              <Clipboard size={15} /> Вставити карточку заказа
            </button>
          ) : (
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-blue-400" />
                <span className="text-sm font-medium text-slate-300">Авторозбір карточки заказа</span>
              </div>
              <textarea
                value={orderCardText}
                onChange={e => setOrderCardText(e.target.value)}
                placeholder="Вставте текст карточки заказа (АЗС, адреса, дата, опис робіт)..."
                rows={5}
                className={`${inputCls} resize-none`}
              />
              <div className="flex items-center gap-2">
                <button onClick={handleParseOrderCard} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                  <Sparkles size={14} /> Заповнити поля
                </button>
                <button onClick={() => { setShowOrderCard(false); setOrderCardText(''); }} className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
                  Скасувати
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Об'єкт / назва" required error={errors.customer}>
              <input value={form.customer} onChange={e => set('customer', e.target.value)} placeholder="Назва об'єкта або ПІБ" className={inputCls} />
            </Field>
            <Field label="Код АЗК">
              <input value={form.azkCode} onChange={e => set('azkCode', e.target.value)} placeholder="напр. АЗС 189" className={inputCls} />
            </Field>
          </div>

          <Field label="Адреса" required error={errors.address}>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="вул., буд., місто" className={inputCls} />
          </Field>

          <Field label="Потреба / опис робіт" required error={errors.description}>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Опишіть обсяг та тип робіт..." rows={3} className={`${inputCls} resize-none`} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Підрядник" required error={errors.contractorId}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                <input
                  value={contractorSearch}
                  onChange={e => setContractorSearch(e.target.value)}
                  placeholder="Пошук: ім'я, телефон, username..."
                  className={`${inputCls} pl-9 mb-2`}
                />
                <select value={form.contractorId} onChange={e => set('contractorId', e.target.value)} className={inputCls}>
                  <option value="">Оберіть підрядника</option>
                  {filteredContractors.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.phone ?? '—'} — {c.regionName ?? '—'}</option>
                  ))}
                </select>
              </div>
            </Field>
            <Field label="Дедлайн" required error={errors.deadline}>
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Коментар менеджера">
            <textarea value={form.managerComment} onChange={e => set('managerComment', e.target.value)} placeholder="Додаткові примітки..." rows={2} className={`${inputCls} resize-none`} />
          </Field>

          <Field label="Сума виплати">
            <div className="relative">
              <input value={form.payoutAmount} onChange={e => set('payoutAmount', e.target.value.replace(/[^\d]/g, ''))} placeholder="0" className={`${inputCls} pr-10`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">₴</span>
            </div>
          </Field>
        </div>

        <div className="sticky bottom-0 bg-[#141720] border-t border-white/5 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
            Скасувати
          </button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Створити заявку
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

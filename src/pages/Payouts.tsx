import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Receipt, Clock, CheckCircle2, Wallet, Check, Eye, X, Loader2, AlertCircle, RefreshCw, FileText, Phone } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { useApp } from '@/context/AppContext';
import { fetchPayouts, confirmPayout, type PayoutItem } from '@/lib/payoutsApi';
import { formatCurrency, formatDate, formatDateTime, getPayoutStatusColor } from '@/utils/helpers';

function getInitials(name?: string): string {
  if (!name) return '—';
  return name.split(' ').map(x => x[0]).slice(0, 2).join('');
}

function ReceiptViewerModal({ payout, onClose }: { payout: PayoutItem; onClose: () => void }) {
  const isImage = payout.receiptType === 'photo' || payout.receiptType === 'image';
  const modal = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#141720] shadow-2xl sm:max-w-lg sm:rounded-2xl sm:max-h-[90vh]">
        <div className="sticky top-0 bg-[#141720] border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
          <span className="text-sm font-semibold text-white">Квитанція виплати {payout.applicationNumber}</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 sm:p-4 lg:p-6">
          {isImage && payout.receiptUrl ? (
            <div className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/5">
              <img src={payout.receiptUrl} alt="Квитанція" className="w-full object-contain" />
            </div>
          ) : payout.receiptUrl ? (
            <div className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-4 border border-white/5">
              <FileText size={20} className="text-slate-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate">{payout.receiptName ?? 'Файл квитанції'}</p>
                <p className="text-xs text-slate-500">{payout.receiptType ?? 'file'}</p>
              </div>
              <a href={payout.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                Відкрити
              </a>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Квитанція не завантажена</p>
          )}
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

function ConfirmPayoutModal({ payout, onClose, onConfirmed }: { payout: PayoutItem; onClose: () => void; onConfirmed: () => void }) {
  const { showToast } = useApp();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await confirmPayout(payout.id, payout.receiptName ?? undefined);
      showToast('Виплату підтверджено', 'success');
      onConfirmed();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка підтвердження виплати';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full rounded-t-3xl border border-white/10 bg-[#141720] shadow-2xl sm:max-w-md sm:rounded-2xl">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Підтвердити виплату</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-xs text-slate-500">Заявка</span><span className="text-sm text-slate-200 font-mono">{payout.applicationNumber}</span></div>
            <div className="flex justify-between"><span className="text-xs text-slate-500">Підрядник</span><span className="text-sm text-slate-200">{payout.contractorName}</span></div>
            <div className="flex justify-between"><span className="text-xs text-slate-500">Телефон</span><span className="text-sm text-slate-200">{payout.contractorPhone ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-xs text-slate-500">Сума</span><span className="text-sm font-semibold text-emerald-400">{formatCurrency(payout.amount)}</span></div>
            {payout.receiptName && (
              <div className="flex justify-between"><span className="text-xs text-slate-500">Квитанція</span><span className="text-sm text-slate-200">{payout.receiptName}</span></div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">Скасувати</button>
          <button onClick={handleConfirm} disabled={submitting} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting && <Loader2 size={15} className="animate-spin" />}
            Підтвердити виплату
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

export default function Payouts() {
  const { showToast } = useApp();
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toConfirm, setToConfirm] = useState<PayoutItem | null>(null);
  const [toView, setToView] = useState<PayoutItem | null>(null);

  const loadPayouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPayouts();
      setPayouts(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка завантаження виплат';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadPayouts(); }, [loadPayouts]);

  const totalPaid = payouts.filter(p => p.payoutStatus === 'Виплачено').reduce((s, p) => s + p.amount, 0);
  const totalPending = payouts.filter(p => p.payoutStatus === 'Очікує').reduce((s, p) => s + p.amount, 0);
  const paidCount = payouts.filter(p => p.payoutStatus === 'Виплачено').length;
  const pendingCount = payouts.filter(p => p.payoutStatus === 'Очікує').length;

  return (
    <PageHeader pageTitle="Виплати" pageSubtitle={`${payouts.length} записів`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="До виплати" value={formatCurrency(totalPending)} icon={<Clock size={18} />} accent="amber" />
        <StatCard title="Виплачено" value={formatCurrency(totalPaid)} icon={<CheckCircle2 size={18} />} accent="green" />
        <StatCard title="Очікують" value={pendingCount} icon={<Wallet size={18} />} accent="amber" />
        <StatCard title="Кількість виплат" value={paidCount + pendingCount} icon={<Receipt size={18} />} accent="blue" />
      </div>

      <div className="md:hidden space-y-3" data-mobile-payouts>
        {loading ? (
          <div className="rounded-2xl border border-white/5 bg-[#141720] py-10 text-center">
            <Loader2 size={20} className="mx-auto animate-spin text-slate-500" />
            <p className="mt-2 text-sm text-slate-500">Завантаження виплат…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/10 bg-[#141720] p-5 text-center">
            <AlertCircle size={22} className="mx-auto text-red-400" />
            <p className="mt-2 text-sm text-red-400">{error}</p>
            <button
              onClick={loadPayouts}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300"
            >
              <RefreshCw size={14} />
              Оновити
            </button>
          </div>
        ) : payouts.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-[#141720] py-10 text-center text-sm text-slate-500">
            Виплат поки немає
          </div>
        ) : (
          payouts.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-white/5 bg-[#141720] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.16)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-blue-400">{p.applicationNumber}</p>
                  <p className="mt-1 truncate text-base font-semibold text-white">{p.contractorName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{p.contractorPhone || 'Телефон не вказано'}</p>
                </div>
                <StatusBadge
                  label={p.payoutStatus}
                  className={getPayoutStatusColor(p.payoutStatus)}
                />
              </div>

              <div className="mt-4 flex items-end justify-between rounded-xl bg-white/[0.025] p-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-600">Сума</p>
                  <p className={`mt-1 text-xl font-semibold ${p.amount > 0 ? 'text-white' : 'text-slate-500'}`}>
                    {p.amount > 0 ? formatCurrency(p.amount) : '—'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-slate-600">Дата виплати</p>
                  <p className="mt-1 text-xs text-slate-400">{p.paidAt ? formatDate(p.paidAt) : 'Ще не виплачено'}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {p.contractorPhone ? (
                  <a
                    href={`tel:${p.contractorPhone}`}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] text-xs font-medium text-slate-300"
                  >
                    <Phone size={15} />
                    Подзвонити
                  </a>
                ) : (
                  <button disabled className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] text-xs text-slate-600">
                    <Phone size={15} />
                    Подзвонити
                  </button>
                )}

                {p.receiptUrl ? (
                  <button
                    onClick={() => setToView(p)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-500/15 bg-blue-500/[0.07] text-xs font-medium text-blue-400"
                  >
                    <Receipt size={15} />
                    Квитанція
                  </button>
                ) : (
                  <div className="flex min-h-11 items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] text-xs text-slate-600">
                    Без квитанції
                  </div>
                )}
              </div>

              {p.payoutStatus === 'Очікує' && p.amount > 0 && (
                <button
                  onClick={() => setToConfirm(p)}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white active:bg-emerald-500"
                >
                  <Check size={16} />
                  Підтвердити виплату
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block bg-[#141720] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto mobile-no-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                {['№ заявки', 'Підрядник', 'Телефон', 'Сума', 'Статус', 'Дата виплати', 'Квитанція', 'Дії'].map(h => (
                  <th key={h} className="text-left text-xs text-slate-500 font-medium px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2 text-slate-500">
                    <Loader2 size={18} className="animate-spin" /><span className="text-sm">Завантаження виплат…</span>
                  </div>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3 text-slate-500">
                    <AlertCircle size={24} className="text-red-400" />
                    <span className="text-sm text-red-400">{error}</span>
                    <button onClick={loadPayouts} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-white/5 hover:bg-white/10 transition-colors">
                      <RefreshCw size={14} /> Спробувати знову
                    </button>
                  </div>
                </td></tr>
              ) : payouts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Wallet size={28} className="text-slate-600" />
                    <p className="text-sm">Виплат поки що немає</p>
                  </div>
                </td></tr>
              ) : payouts.map((p, i) => (
                <tr key={p.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${i === payouts.length - 1 ? 'border-0' : ''}`}>
                  <td className="px-5 py-4"><span className="font-mono text-xs text-blue-400">{p.applicationNumber}</span></td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-xs font-semibold shrink-0">{getInitials(p.contractorName)}</div>
                      <span className="text-slate-300 truncate max-w-[180px]">{p.contractorName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-400 whitespace-nowrap">{p.contractorPhone ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`font-semibold ${p.amount > 0 ? 'text-slate-100' : 'text-slate-500'}`}>{p.amount > 0 ? formatCurrency(p.amount) : '—'}</span>
                  </td>
                  <td className="px-5 py-4"><StatusBadge label={p.payoutStatus} className={getPayoutStatusColor(p.payoutStatus)} /></td>
                  <td className="px-5 py-4 text-slate-400">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                  <td className="px-5 py-4">
                    {p.receiptUrl ? (
                      <button onClick={() => setToView(p)} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                        <Receipt size={13} /> {p.receiptName ?? 'Квитанція'}
                      </button>
                    ) : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {p.payoutStatus === 'Очікує' && p.amount > 0 && (
                        <button onClick={() => setToConfirm(p)} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors px-2 py-1 rounded-md hover:bg-emerald-400/5">
                          <Check size={13} /> Підтвердити
                        </button>
                      )}
                      {p.receiptUrl && (
                        <button onClick={() => setToView(p)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded-md hover:bg-white/5">
                          <Eye size={13} /> Переглянути
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {toConfirm && <ConfirmPayoutModal payout={toConfirm} onClose={() => setToConfirm(null)} onConfirmed={loadPayouts} />}
      {toView && <ReceiptViewerModal payout={toView} onClose={() => setToView(null)} />}
    </PageHeader>
  );
}

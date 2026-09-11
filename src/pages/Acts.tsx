import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, FileText, Image as ImageIcon, Loader2, AlertCircle,
  RefreshCw, User, MapPin, FileCheck, Calendar, Phone,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, AlertTriangle, Hash,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { fetchActs, updateActStatus, type ActItem, type ActFile, type ActStatus } from '@/lib/actsApi';
import { formatDate, formatDateTime, getActStatusColor, actStatusLabel } from '@/utils/helpers';

function TelegramImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');

  return (
    <>
      {state !== 'loaded' && (
        <div className={`absolute inset-0 flex items-center justify-center bg-white/[0.02] ${className ?? ''}`}>
          {state === 'loading' ? (
            <Loader2 size={24} className="text-slate-600 animate-spin" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-slate-600">
              <ImageIcon size={24} />
              <span className="text-xs">Фото недоступне</span>
            </div>
          )}
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`${className ?? ''} ${state === 'loaded' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
      />
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm text-slate-200 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

function FileGallery({ files }: { files: ActFile[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const photoFiles = files.filter(f => f.fileType === 'photo');
  const otherFiles = files.filter(f => f.fileType !== 'photo');

  if (photoFiles.length === 0 && otherFiles.length === 0) {
    return <p className="text-sm text-slate-500">Файлів немає</p>;
  }

  return (
    <div className="space-y-3">
      {photoFiles.length > 0 && (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden bg-white/[0.03] border border-white/5">
            <div className="aspect-video flex items-center justify-center">
              <TelegramImage
                src={photoFiles[activeIndex].url}
                alt={`Фото ${activeIndex + 1}`}
                className="w-full h-full object-contain"
              />
            </div>
            {photoFiles.length > 1 && (
              <>
                <button
                  onClick={() => setActiveIndex(i => (i - 1 + photoFiles.length) % photoFiles.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setActiveIndex(i => (i + 1) % photoFiles.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photoFiles.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === activeIndex ? 'bg-blue-400' : 'bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-slate-300">
                  {activeIndex + 1} / {photoFiles.length}
                </div>
              </>
            )}
          </div>
          {photoFiles.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photoFiles.map((file, i) => (
                <button
                  key={file.id}
                  onClick={() => setActiveIndex(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === activeIndex ? 'border-blue-400' : 'border-transparent hover:border-white/20'
                  }`}
                >
                  <TelegramImage
                    src={file.url}
                    alt={`Мініатюра ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {otherFiles.length > 0 && (
        <div className="space-y-2">
          {otherFiles.map(file => (
            <div key={file.id} className="flex items-center gap-3 bg-white/[0.03] rounded-lg p-3 border border-white/5">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                <FileText size={18} className="text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-200 truncate">{file.fileName ?? 'Без назви'}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {file.fileType} · {formatDate(file.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActDetailModal({
  act,
  onClose,
  onStatusChange,
}: {
  act: ActItem;
  onClose: () => void;
  onStatusChange: (actId: string, status: ActStatus) => Promise<void>;
}) {
  const { showToast } = useApp();
  const [currentStatus, setCurrentStatus] = useState<ActStatus>(act.status);
  const [saving, setSaving] = useState<'approved' | 'rejected' | null>(null);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  const handleApprove = async () => {
    setSaving('approved');
    try {
      await onStatusChange(act.id, 'approved');
      setCurrentStatus('approved');
      showToast('Акт підтверджено', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка оновлення статусу';
      showToast(msg, 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleReject = async () => {
    setShowRejectConfirm(false);
    setSaving('rejected');
    try {
      await onStatusChange(act.id, 'rejected');
      setCurrentStatus('rejected');
      showToast('Акт відхилено', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка оновлення статусу';
      showToast(msg, 'error');
    } finally {
      setSaving(null);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141720] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#141720] border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-blue-400 font-semibold">{act.actNumber ?? '—'}</span>
            <StatusBadge label={actStatusLabel(currentStatus)} className={getActStatusColor(currentStatus)} />
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Application */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Заявка</h3>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Номер заявки" value={act.applicationNumber} mono />
              <DetailRow label="Код АЗК" value={
                <span className="flex items-center gap-1"><Hash size={12} className="text-slate-500" />{act.applicationAzkCode ?? '—'}</span>
              } />
              <DetailRow label="Об'єкт" value={act.applicationTitle} />
              <div className="col-span-2">
                <DetailRow label="Адреса" value={
                  <span className="flex items-center gap-1"><MapPin size={12} className="text-slate-500 shrink-0" />{act.applicationAddress ?? '—'}</span>
                } />
              </div>
              <div className="col-span-2">
                <DetailRow label="Опис / потреба" value={act.applicationDescription ?? '—'} />
              </div>
            </div>
          </section>

          <div className="h-px bg-white/5" />

          {/* Contractor */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Підрядник</h3>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="ПІБ" value={
                <span className="flex items-center gap-1"><User size={12} className="text-slate-500" />{act.contractorName}</span>
              } />
              <DetailRow label="Телефон" value={
                act.contractorPhone ? (
                  <a href={`tel:${act.contractorPhone}`} className="text-blue-400 hover:underline flex items-center gap-1">
                    <Phone size={12} />{act.contractorPhone}
                  </a>
                ) : '—'
              } />
            </div>
          </section>

          <div className="h-px bg-white/5" />

          {/* Dates */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Дата та статус</h3>
            <div className="grid grid-cols-2 gap-4">
              <DetailRow label="Дата акта" value={
                <span className="flex items-center gap-1"><Calendar size={12} className="text-slate-500" />{act.actDate ? formatDateTime(act.actDate) : '—'}</span>
              } />
              <DetailRow label="Завантажено" value={
                <span className="flex items-center gap-1"><Calendar size={12} className="text-slate-500" />{formatDateTime(act.createdAt)}</span>
              } />
              {act.reviewedAt && (
                <DetailRow label="Перевірено" value={formatDateTime(act.reviewedAt)} />
              )}
            </div>
          </section>

          <div className="h-px bg-white/5" />

          {/* Files */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Файли акта {act.files.length > 0 && `(${act.files.length})`}
            </h3>
            <FileGallery files={act.files} />
          </section>
        </div>

        {/* Action buttons */}
        <div className="sticky bottom-0 bg-[#141720] border-t border-white/5 px-6 py-4 flex items-center gap-3">
          <button
            onClick={handleApprove}
            disabled={saving !== null || currentStatus === 'approved'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving === 'approved' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Підтвердити
          </button>
          <button
            onClick={() => setShowRejectConfirm(true)}
            disabled={saving !== null || currentStatus === 'rejected'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving === 'rejected' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            Відхилити
          </button>
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
          >
            Закрити
          </button>
        </div>
      </div>

      {showRejectConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowRejectConfirm(false)} />
          <div className="relative bg-[#141720] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Відхилити акт?</h3>
              <p className="text-sm text-slate-400 mb-6">Акт {act.actNumber ?? '—'} буде відхилено. Підтвердіть дію.</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowRejectConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-colors"
                >
                  Відхилити
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modal, document.body);
}

export default function Acts() {
  const { showToast } = useApp();
  const [acts, setActs] = useState<ActItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActItem | null>(null);

  const loadActs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchActs();
      setActs(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка завантаження актів';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadActs();
  }, [loadActs]);

  const handleStatusChange = useCallback(async (actId: string, status: ActStatus) => {
    await updateActStatus(actId, status);
    setActs(prev => prev.map(a =>
      a.id === actId
        ? { ...a, status, reviewedAt: new Date().toISOString() }
        : a
    ));
    setSelected(prev =>
      prev && prev.id === actId
        ? { ...prev, status, reviewedAt: new Date().toISOString() }
        : prev
    );
  }, []);

  return (
    <>
      <PageHeader
        pageTitle="Акти"
        pageSubtitle={`${acts.length} завантажених актів`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Завантаження актів…</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <AlertCircle size={24} className="text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
            <button
              onClick={loadActs}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 bg-white/5 hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={14} /> Спробувати знову
            </button>
          </div>
        ) : acts.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            Актів ще не завантажено
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {acts.map(act => {
              const firstPhoto = act.files.find(f => f.fileType === 'photo');
              const firstFile = act.files[0];
              return (
                <div
                  key={act.id}
                  className="bg-[#141720] border border-white/5 rounded-xl overflow-hidden hover:border-white/15 transition-all duration-200 group cursor-pointer"
                  onClick={() => setSelected(act)}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.02]">
                    {firstPhoto ? (
                      <TelegramImage
                        src={firstPhoto.url}
                        alt={`Акт ${act.actNumber ?? ''}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : firstFile ? (
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500 h-full">
                        <FileText size={32} className="text-slate-600" />
                        <span className="text-xs text-slate-500">{firstFile.fileType}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-500 h-full">
                        <FileCheck size={32} className="text-slate-600" />
                        <span className="text-xs text-slate-500">Без файлів</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <StatusBadge label={actStatusLabel(act.status)} className={getActStatusColor(act.status)} />
                    </div>
                    {act.files.length > 1 && (
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-0.5 text-xs text-slate-300">
                        {act.files.length} файлів
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-blue-400 font-semibold">{act.actNumber ?? '—'}</span>
                      <span className="text-xs text-slate-500">{formatDate(act.actDate ?? act.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-300 truncate">{act.contractorName}</p>
                    <p className="text-xs text-slate-500 truncate">
                      Заявка {act.applicationNumber}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageHeader>

      {selected && (
        <ActDetailModal
          act={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  RefreshCw,
  User,
  MapPin,
  FileCheck,
  Calendar,
  Phone,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Hash,
  Trash2,
  Search,
  SlidersHorizontal,
  Eye,
  Files,
} from 'lucide-react';

import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';

import {
  fetchActs,
  updateActStatus,
  deleteActAndApplication,
  type ActItem,
  type ActFile,
  type ActStatus,
} from '@/lib/actsApi';

import {
  formatDate,
  formatDateTime,
  getActStatusColor,
  actStatusLabel,
} from '@/utils/helpers';

// =====================================================
// TELEGRAM IMAGE
// =====================================================

function TelegramImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [state, setState] = useState<
    'loading' | 'loaded' | 'error'
  >('loading');

  return (
    <>
      {state !== 'loaded' && (
        <div
          className={`absolute inset-0 flex items-center justify-center bg-white/[0.02] ${
            className ?? ''
          }`}
        >
          {state === 'loading' ? (
            <Loader2
              size={24}
              className="animate-spin text-slate-600"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-slate-600">
              <ImageIcon size={24} />
              <span className="text-xs">
                Фото недоступне
              </span>
            </div>
          )}
        </div>
      )}

      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={`${className ?? ''} ${
          state === 'loaded'
            ? 'opacity-100'
            : 'opacity-0'
        } transition-opacity duration-300`}
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
      />
    </>
  );
}

// =====================================================
// DETAIL ROW
// =====================================================

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-slate-500">
        {label}
      </span>

      <span
        className={`text-sm text-slate-200 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value ?? '—'}
      </span>
    </div>
  );
}

// =====================================================
// FILE GALLERY
// =====================================================

function isImageFile(file: ActFile): boolean {
  const type = (file.fileType ?? '').toLowerCase();
  const name = (file.fileName ?? '').toLowerCase();

  return (
    type === 'photo' ||
    type === 'image' ||
    type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(name)
  );
}

function FileGallery({
  files,
}: {
  files: ActFile[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const photoFiles = files.filter(isImageFile);
  const otherFiles = files.filter((file) => !isImageFile(file));

  useEffect(() => {
    setActiveIndex(0);
  }, [files]);

  if (photoFiles.length === 0 && otherFiles.length === 0) {
    return <p className="text-sm text-slate-500">Файлів немає</p>;
  }

  const activePhoto = photoFiles[activeIndex];

  return (
    <div className="space-y-3">
      {photoFiles.length > 0 && activePhoto && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]">
            <a
              href={activePhoto.url}
              target="_blank"
              rel="noreferrer"
              className="group block"
              title="Відкрити фото у повному розмірі"
            >
              <div className="relative flex aspect-video items-center justify-center">
                <TelegramImage
                  src={activePhoto.url}
                  alt={activePhoto.fileName ?? `Фото ${activeIndex + 1}`}
                  className="h-full w-full object-contain"
                />

                <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    <Eye size={14} />
                    Відкрити фото
                  </span>
                </div>
              </div>
            </a>

            {photoFiles.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex(
                      (index) =>
                        (index - 1 + photoFiles.length) % photoFiles.length,
                    )
                  }
                  className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                >
                  <ChevronLeft size={20} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex(
                      (index) => (index + 1) % photoFiles.length,
                    )
                  }
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                >
                  <ChevronRight size={20} />
                </button>

                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {photoFiles.map((_, index) => (
                    <button
                      type="button"
                      key={index}
                      onClick={() => setActiveIndex(index)}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        index === activeIndex
                          ? 'bg-blue-400'
                          : 'bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>

                <div className="absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-slate-300 backdrop-blur-sm">
                  {activeIndex + 1} / {photoFiles.length}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-200">
                {activePhoto.fileName ?? 'Фото акта'}
              </p>
              <p className="text-xs text-slate-500">
                {formatDate(activePhoto.createdAt)}
              </p>
            </div>

            <a
              href={activePhoto.url}
              target="_blank"
              rel="noreferrer"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
            >
              <Eye size={14} />
              Переглянути
            </a>
          </div>

          {photoFiles.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photoFiles.map((file, index) => (
                <button
                  type="button"
                  key={file.id}
                  onClick={() => setActiveIndex(index)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    index === activeIndex
                      ? 'border-blue-400'
                      : 'border-transparent hover:border-white/20'
                  }`}
                >
                  <div className="relative h-full w-full">
                    <TelegramImage
                      src={file.url}
                      alt={`Мініатюра ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {otherFiles.length > 0 && (
        <div className="space-y-2">
          {otherFiles.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.03] p-3 transition-colors hover:border-blue-500/20 hover:bg-white/[0.06]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5">
                <FileText size={18} className="text-slate-400" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">
                  {file.fileName ?? 'Без назви'}
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  {file.fileType} · {formatDate(file.createdAt)}
                </p>
              </div>

              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-blue-400">
                <Eye size={14} />
                Відкрити
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================
// ACT DETAIL MODAL
// =====================================================

function ActDetailModal({
  act,
  onClose,
  onStatusChange,
  onDelete,
}: {
  act: ActItem;
  onClose: () => void;
  onStatusChange: (
    actId: string,
    status: ActStatus,
  ) => Promise<void>;
  onDelete: (
    act: ActItem,
  ) => Promise<void>;
}) {
  const { showToast } = useApp();

  const [currentStatus, setCurrentStatus] =
    useState<ActStatus>(
      act.status,
    );

  const [saving, setSaving] =
    useState<
      'approved' | 'rejected' | null
    >(null);

  const [
    showRejectConfirm,
    setShowRejectConfirm,
  ] = useState(false);

  const [
    showDeleteConfirm,
    setShowDeleteConfirm,
  ] = useState(false);

  const [deleting, setDeleting] =
    useState(false);

  useEffect(() => {
    setCurrentStatus(act.status);
  }, [act.id, act.status]);

  // ===================================================
  // APPROVE
  // ===================================================

  const handleApprove =
    async () => {
      setSaving('approved');

      try {
        await onStatusChange(
          act.id,
          'approved',
        );

        setCurrentStatus(
          'approved',
        );

        showToast(
          'Акт підтверджено',
          'success',
        );
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Помилка оновлення статусу';

        showToast(
          msg,
          'error',
        );
      } finally {
        setSaving(null);
      }
    };

  // ===================================================
  // REJECT
  // ===================================================

  const handleReject =
    async () => {
      setShowRejectConfirm(
        false,
      );

      setSaving('rejected');

      try {
        await onStatusChange(
          act.id,
          'rejected',
        );

        setCurrentStatus(
          'rejected',
        );

        showToast(
          'Акт відхилено',
          'success',
        );
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Помилка оновлення статусу';

        showToast(
          msg,
          'error',
        );
      } finally {
        setSaving(null);
      }
    };

  // ===================================================
  // DELETE
  // ===================================================

  const handleDelete =
    async () => {
      setDeleting(true);

      try {
        await onDelete(act);

        showToast(
          `Акт ${
            act.actNumber ?? ''
          } і заявку ${
            act.applicationNumber
          } видалено`,
          'success',
        );

        setShowDeleteConfirm(
          false,
        );

        onClose();
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Помилка видалення';

        showToast(
          msg,
          'error',
        );
      } finally {
        setDeleting(false);
      }
    };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#141720] shadow-2xl">

        {/* HEADER */}

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#141720] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-blue-400">
              {act.actNumber ??
                '—'}
            </span>

            <StatusBadge
              label={actStatusLabel(
                currentStatus,
              )}
              className={getActStatusColor(
                currentStatus,
              )}
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* CONTENT */}

        <div className="space-y-6 p-6">

          {/* APPLICATION */}

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Заявка
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <DetailRow
                label="Номер заявки"
                value={
                  act.applicationNumber
                }
                mono
              />

              <DetailRow
                label="Код АЗК"
                value={
                  <span className="flex items-center gap-1">
                    <Hash
                      size={12}
                      className="text-slate-500"
                    />

                    {act.applicationAzkCode ??
                      '—'}
                  </span>
                }
              />

              <DetailRow
                label="Об'єкт"
                value={
                  act.applicationTitle
                }
              />

              <div className="col-span-2">
                <DetailRow
                  label="Адреса"
                  value={
                    <span className="flex items-center gap-1">
                      <MapPin
                        size={12}
                        className="shrink-0 text-slate-500"
                      />

                      {act.applicationAddress ??
                        '—'}
                    </span>
                  }
                />
              </div>

              <div className="col-span-2">
                <DetailRow
                  label="Опис / потреба"
                  value={
                    act.applicationDescription ??
                    '—'
                  }
                />
              </div>
            </div>
          </section>

          <div className="h-px bg-white/5" />

          {/* CONTRACTOR */}

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Підрядник
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <DetailRow
                label="ПІБ"
                value={
                  <span className="flex items-center gap-1">
                    <User
                      size={12}
                      className="text-slate-500"
                    />

                    {
                      act.contractorName
                    }
                  </span>
                }
              />

              <DetailRow
                label="Телефон"
                value={
                  act.contractorPhone ? (
                    <a
                      href={`tel:${act.contractorPhone}`}
                      className="flex items-center gap-1 text-blue-400 hover:underline"
                    >
                      <Phone
                        size={12}
                      />

                      {
                        act.contractorPhone
                      }
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </div>
          </section>

          <div className="h-px bg-white/5" />

          {/* DATES */}

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Дата та статус
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <DetailRow
                label="Дата акта"
                value={
                  <span className="flex items-center gap-1">
                    <Calendar
                      size={12}
                      className="text-slate-500"
                    />

                    {act.actDate
                      ? formatDateTime(
                          act.actDate,
                        )
                      : '—'}
                  </span>
                }
              />

              <DetailRow
                label="Завантажено"
                value={
                  <span className="flex items-center gap-1">
                    <Calendar
                      size={12}
                      className="text-slate-500"
                    />

                    {formatDateTime(
                      act.createdAt,
                    )}
                  </span>
                }
              />

              {act.reviewedAt && (
                <DetailRow
                  label="Перевірено"
                  value={formatDateTime(
                    act.reviewedAt,
                  )}
                />
              )}
            </div>
          </section>

          <div className="h-px bg-white/5" />

          {/* FILES */}

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Файли акта{' '}
              {act.files.length >
                0 &&
                `(${act.files.length})`}
            </h3>

            <FileGallery
              files={act.files}
            />
          </section>
        </div>

        {/* ACTIONS */}

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-white/5 bg-[#141720] px-6 py-4">

          <button
            type="button"
            onClick={handleApprove}
            disabled={
              saving !== null ||
              currentStatus ===
                'approved'
            }
            className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ===
            'approved' ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <CheckCircle2
                size={16}
              />
            )}

            Підтвердити
          </button>

          <button
            type="button"
            onClick={() =>
              setShowRejectConfirm(
                true,
              )
            }
            disabled={
              saving !== null ||
              currentStatus ===
                'rejected'
            }
            className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ===
            'rejected' ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <XCircle
                size={16}
              />
            )}

            Відхилити
          </button>

          <button
            type="button"
            onClick={() =>
              setShowDeleteConfirm(
                true,
              )
            }
            disabled={deleting}
            className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Trash2
                size={16}
              />
            )}

            Видалити
          </button>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
          >
            Закрити
          </button>
        </div>
      </div>

      {/* REJECT CONFIRM */}

      {showRejectConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() =>
              setShowRejectConfirm(
                false,
              )
            }
          />

          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#141720] shadow-2xl">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle
                  size={24}
                  className="text-red-400"
                />
              </div>

              <h3 className="mb-2 text-base font-semibold text-white">
                Відхилити акт?
              </h3>

              <p className="mb-6 text-sm text-slate-400">
                Акт{' '}
                {act.actNumber ??
                  '—'}{' '}
                буде відхилено.
                Підтвердіть дію.
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setShowRejectConfirm(
                      false,
                    )
                  }
                  className="flex-1 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                >
                  Скасувати
                </button>

                <button
                  type="button"
                  onClick={
                    handleReject
                  }
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
                >
                  Відхилити
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => {
              if (!deleting) {
                setShowDeleteConfirm(
                  false,
                );
              }
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-[#141720] p-6 shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <Trash2
                size={23}
                className="text-red-400"
              />
            </div>

            <h3 className="mt-4 text-center text-base font-semibold text-white">
              Видалити акт і
              заявку?
            </h3>

            <p className="mt-3 text-center text-sm leading-6 text-slate-400">
              Буде повністю
              видалено акт{' '}
              <span className="font-mono text-white">
                {act.actNumber ??
                  '—'}
              </span>{' '}
              та пов'язану
              заявку{' '}
              <span className="font-mono text-white">
                {
                  act.applicationNumber
                }
              </span>
              .
            </p>

            <div className="mt-3 rounded-lg border border-red-500/10 bg-red-500/[0.05] p-3 text-center text-xs text-red-300">
              Цю дію неможливо
              скасувати.
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowDeleteConfirm(
                    false,
                  )
                }
                disabled={deleting}
                className="flex-1 rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50"
              >
                Скасувати
              </button>

              <button
                type="button"
                onClick={
                  handleDelete
                }
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2
                    size={16}
                  />
                )}

                Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(
    modal,
    document.body,
  );
}

// =====================================================
// ACTS PAGE
// =====================================================


type ActFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function Acts() {
  const { showToast } = useApp();

  const [acts, setActs] = useState<ActItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActItem | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ActFilter>('all');
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 12;

  // ===================================================
  // LOAD ACTS
  // ===================================================

  const loadActs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchActs();
      setActs(data);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Помилка завантаження актів';

      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadActs();
  }, [loadActs]);

  // ===================================================
  // OPEN ACT FROM NOTIFICATION
  // ===================================================

  useEffect(() => {
    if (loading) return;

    const actId = sessionStorage.getItem('rvp-open-act-id');
    if (!actId) return;

    const act = acts.find(
      (item) => String(item.id) === String(actId),
    );

    if (act) {
      setSelected(act);
      sessionStorage.removeItem('rvp-open-act-id');
    }
  }, [acts, loading]);

  // ===================================================
  // STATUS CHANGE
  // ===================================================

  const handleStatusChange = useCallback(
    async (actId: string, status: ActStatus) => {
      await updateActStatus(actId, status);

      const reviewedAt = new Date().toISOString();

      setActs((prev) =>
        prev.map((act) =>
          act.id === actId
            ? { ...act, status, reviewedAt }
            : act,
        ),
      );

      setSelected((prev) =>
        prev && prev.id === actId
          ? { ...prev, status, reviewedAt }
          : prev,
      );
    },
    [],
  );

  // ===================================================
  // DELETE ACT + APPLICATION
  // ===================================================

  const handleDelete = useCallback(
    async (act: ActItem) => {
      await deleteActAndApplication(act.id);

      setActs((prev) =>
        prev.filter((item) => item.id !== act.id),
      );

      setSelected(null);
      sessionStorage.removeItem('rvp-open-act-id');
    },
    [],
  );

  // ===================================================
  // FILTERS / STATS
  // ===================================================

  const counts = {
    all: acts.length,
    pending: acts.filter((act) => act.status === 'pending').length,
    approved: acts.filter((act) => act.status === 'approved').length,
    rejected: acts.filter((act) => act.status === 'rejected').length,
  };

  const filteredActs = acts.filter((act) => {
    if (filter !== 'all' && act.status !== filter) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;

    return [
      act.actNumber,
      act.applicationNumber,
      act.applicationAzkCode,
      act.applicationTitle,
      act.applicationAddress,
      act.contractorName,
      act.contractorPhone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredActs.length / PAGE_SIZE),
  );

  const safePage = Math.min(page, totalPages);

  const visibleActs = filteredActs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  const setStatusFilter = (value: ActFilter) => {
    setFilter(value);
    setPage(1);
  };

  const filterButton = (
    value: ActFilter,
    label: string,
    count: number,
  ) => {
    const active = filter === value;

    return (
      <button
        type="button"
        onClick={() => setStatusFilter(value)}
        className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
          active
            ? 'border-blue-500 text-white'
            : 'border-transparent text-slate-500 hover:text-slate-300'
        }`}
      >
        {label}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] ${
            active
              ? 'bg-blue-500/15 text-blue-400'
              : 'bg-white/5 text-slate-600'
          }`}
        >
          {count}
        </span>
      </button>
    );
  };

  // ===================================================
  // PAGE
  // ===================================================

  return (
    <>
      <PageHeader
        pageTitle="Акти"
        pageSubtitle="Контроль документів та виконаних робіт"
        actions={
          <button
            type="button"
            onClick={loadActs}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={loading ? 'animate-spin' : ''}
            />
            Оновити
          </button>
        }
      >
        {/* KPI */}

        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-[#141821] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Всього актів</span>
              <Files size={16} className="text-blue-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">
              {counts.all}
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/10 bg-[#141821] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Очікують</span>
              <FileCheck size={16} className="text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-amber-400">
              {counts.pending}
            </p>
          </div>

          <div className="rounded-xl border border-emerald-500/10 bg-[#141821] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Підтверджені</span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">
              {counts.approved}
            </p>
          </div>

          <div className="rounded-xl border border-red-500/10 bg-[#141821] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Відхилені</span>
              <XCircle size={16} className="text-red-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-red-400">
              {counts.rejected}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#121720]">
          {/* TABS */}

          <div className="flex gap-6 overflow-x-auto border-b border-white/[0.06] px-5">
            {filterButton('all', 'Усі', counts.all)}
            {filterButton('pending', 'Очікують', counts.pending)}
            {filterButton('approved', 'Підтверджені', counts.approved)}
            {filterButton('rejected', 'Відхилені', counts.rejected)}
          </div>

          {/* SEARCH */}

          <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Пошук за актом, заявкою, АЗК, підрядником..."
                className="w-full rounded-lg border border-white/[0.07] bg-white/[0.025] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-700 focus:border-blue-500/30"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <SlidersHorizontal size={14} />
              Знайдено: {filteredActs.length}
            </div>
          </div>

          {/* CONTENT */}

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-slate-600">
                <Loader2 size={22} className="animate-spin text-blue-400" />
                <span className="text-xs">Завантаження актів…</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
                <AlertCircle size={22} className="text-red-400" />
              </div>

              <p className="mt-3 text-sm text-red-400">{error}</p>

              <button
                type="button"
                onClick={loadActs}
                className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.06]"
              >
                <RefreshCw size={13} />
                Спробувати знову
              </button>
            </div>
          ) : filteredActs.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.03]">
                <FileCheck size={22} className="text-slate-700" />
              </div>

              <p className="mt-3 text-sm font-medium text-slate-400">
                Актів не знайдено
              </p>

              <p className="mt-1 text-xs text-slate-600">
                Змініть пошук або фільтр
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-white/[0.05] text-left">
                      <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Акт
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Заявка
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Об'єкт
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Підрядник
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Файли
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Дата
                      </th>
                      <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Статус
                      </th>
                      <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Дія
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/[0.045]">
                    {visibleActs.map((act) => (
                      <tr
                        key={act.id}
                        onClick={() => setSelected(act)}
                        className="cursor-pointer transition-colors hover:bg-white/[0.025]"
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-mono text-xs font-semibold text-blue-400">
                            {act.actNumber ?? '—'}
                          </div>
                          <div className="mt-1 max-w-[150px] truncate text-[10px] text-slate-700">
                            {String(act.id).slice(0, 12)}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-xs font-medium text-slate-300">
                            {act.applicationNumber}
                          </div>
                          {act.applicationAzkCode && (
                            <div className="mt-1 text-[10px] text-slate-600">
                              АЗК {act.applicationAzkCode}
                            </div>
                          )}
                        </td>

                        <td className="max-w-[260px] px-4 py-3.5">
                          <div className="truncate text-xs text-slate-300">
                            {act.applicationTitle ?? '—'}
                          </div>
                          <div className="mt-1 truncate text-[10px] text-slate-600">
                            {act.applicationAddress ?? 'Адресу не вказано'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="text-xs text-slate-300">
                            {act.contractorName || '—'}
                          </div>
                          {act.contractorPhone && (
                            <div className="mt-1 text-[10px] text-slate-600">
                              {act.contractorPhone}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            {act.files.some((file) => file.fileType === 'photo') ? (
                              <ImageIcon size={14} className="text-violet-400" />
                            ) : (
                              <FileText size={14} className="text-slate-500" />
                            )}
                            {act.files.length}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">
                          {formatDate(act.actDate ?? act.createdAt)}
                        </td>

                        <td className="px-4 py-3.5">
                          <StatusBadge
                            label={actStatusLabel(act.status)}
                            className={getActStatusColor(act.status)}
                          />
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelected(act);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.02] text-slate-500 transition hover:border-blue-500/20 hover:bg-blue-500/10 hover:text-blue-400"
                            title="Відкрити акт"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}

              <div className="divide-y divide-white/[0.05] md:hidden">
                {visibleActs.map((act) => (
                  <button
                    type="button"
                    key={act.id}
                    onClick={() => setSelected(act)}
                    className="w-full p-4 text-left transition-colors hover:bg-white/[0.025]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs font-semibold text-blue-400">
                          {act.actNumber ?? '—'}
                        </p>

                        <p className="mt-1 truncate text-sm font-medium text-slate-300">
                          {act.applicationNumber}
                        </p>
                      </div>

                      <StatusBadge
                        label={actStatusLabel(act.status)}
                        className={getActStatusColor(act.status)}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-slate-600">
                          Підрядник
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-400">
                          {act.contractorName || '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] text-slate-600">
                          Дата
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(act.actDate ?? act.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
                      <span className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <Files size={12} />
                        {act.files.length} файлів
                      </span>

                      <ChevronRight size={14} className="text-slate-700" />
                    </div>
                  </button>
                ))}
              </div>

              {/* PAGINATION */}

              <div className="flex flex-col gap-3 border-t border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-600">
                  Показано{' '}
                  {Math.min(
                    (safePage - 1) * PAGE_SIZE + 1,
                    filteredActs.length,
                  )}
                  {' — '}
                  {Math.min(
                    safePage * PAGE_SIZE,
                    filteredActs.length,
                  )}{' '}
                  з {filteredActs.length}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-slate-500 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span className="min-w-[80px] text-center text-xs text-slate-500">
                    {safePage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(totalPages, current + 1),
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] text-slate-500 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </PageHeader>

      {selected && (
        <ActDetailModal
          act={selected}
          onClose={() => {
            setSelected(null);
            sessionStorage.removeItem('rvp-open-act-id');
          }}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

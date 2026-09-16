import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  UserRoundCheck,
  X,
  XCircle,
} from 'lucide-react';

import type { Application } from '@/types';
import StatusBadge from '@/components/StatusBadge';
import { useApp } from '@/context/AppContext';
import { formatDateTime, getApplicationStatusColor } from '@/utils/helpers';
import {
  assignApplicationContractor,
  fetchWorkHistory,
  updateApplicationStatus,
  type WorkHistoryEntry,
} from '@/lib/applicationsApi';
import {
  fetchContractors,
  type ContractorListItem,
} from '@/lib/contractorsApi';
import {
  fetchApplicationEvents,
  fetchApplicationAttentionState,
  updateApplicationDeadline,
  reportApplicationProblem,
  resolveApplicationProblem,
  cancelApplication,
  reopenApplication,
  type ApplicationEvent,
} from '@/lib/operationsApi';
import {
  fetchApplicationComments,
  insertApplicationComment,
} from '@/lib/applicationCommentsApi';
import {
  deleteApplicationFile,
  fetchApplicationFiles,
  uploadApplicationFile,
  type ApplicationFile,
  type ApplicationMediaCategory,
} from '@/lib/applicationFilesApi';

interface CommentView {
  id: string;
  adminName: string;
  message: string;
  createdAt: string;
}

interface Props {
  application: Application;
  onClose: () => void;
  onChanged?: () => Promise<void> | void;
}

const categoryLabels: Record<ApplicationMediaCategory, string> = {
  before: 'Фото «До»',
  after: 'Фото «Після»',
  document: 'Документ',
  other: 'Інше',
};

function toLocalInputValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function eventIcon(type: string) {
  if (type.includes('problem')) return <AlertTriangle size={15} className="text-rose-400" />;
  if (type.includes('file') || type.includes('act')) return <Paperclip size={15} className="text-cyan-400" />;
  if (type.includes('comment')) return <MessageSquarePlus size={15} className="text-violet-400" />;
  if (type.includes('completed') || type.includes('approved')) return <CheckCircle2 size={15} className="text-emerald-400" />;
  if (type.includes('deadline')) return <CalendarClock size={15} className="text-amber-400" />;
  if (type.includes('contractor')) return <UserRoundCheck size={15} className="text-blue-400" />;
  return <Clock3 size={15} className="text-slate-400" />;
}

export default function ApplicationActionDrawer({ application, onClose, onChanged }: Props) {
  const { showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [contractors, setContractors] = useState<ContractorListItem[]>([]);
  const [contractorId, setContractorId] = useState(application.contractorId || '');
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [legacyHistory, setLegacyHistory] = useState<WorkHistoryEntry[]>([]);
  const [files, setFiles] = useState<ApplicationFile[]>([]);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [hasProblem, setHasProblem] = useState(false);
  const [problemComment, setProblemComment] = useState('');
  const [deadlineValue, setDeadlineValue] = useState(toLocalInputValue(application.deadline));
  const [commentText, setCommentText] = useState('');
  const [fileCategory, setFileCategory] = useState<ApplicationMediaCategory>('before');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tab, setTab] = useState<'actions' | 'media' | 'timeline'>('actions');

  const isFinished = application.status === 'Виконана' || application.status === 'Скасована';

  const loadExtra = async () => {
    setLoading(true);
    try {
      const [contractorRows, eventRows, historyRows, fileRows, commentRows, attention] = await Promise.all([
        fetchContractors(),
        fetchApplicationEvents(application.id),
        fetchWorkHistory(application.id).catch(() => [] as WorkHistoryEntry[]),
        fetchApplicationFiles(application.id),
        fetchApplicationComments(application.id).catch(() => [] as any[]),
        fetchApplicationAttentionState(application.id),
      ]);

      setContractors(contractorRows);
      setEvents(eventRows);
      setLegacyHistory(historyRows);
      setFiles(fileRows);
      setComments(
        commentRows.map((row: any) => ({
          id: row.id,
          adminName: row.adminName || 'Адміністратор',
          message: row.message,
          createdAt: row.createdAt,
        })),
      );
      setHasProblem(attention.hasProblem);
      setProblemComment(attention.problemComment);
      setDeadlineValue(toLocalInputValue(attention.deadlineAt));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не вдалося завантажити центр дій', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setContractorId(application.contractorId || '');
    setDeadlineValue(toLocalInputValue(application.deadline));
    void loadExtra();
  }, [application.id]);

  const refreshAll = async () => {
    await loadExtra();
    await onChanged?.();
  };

  const runAction = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await action();
      showToast(success, 'success');
      await refreshAll();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не вдалося виконати дію', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleAssign = () => {
    if (!contractorId) {
      showToast('Оберіть підрядника', 'error');
      return;
    }
    void runAction(
      'assign',
      () => assignApplicationContractor(application.id, contractorId),
      application.contractorId ? 'Підрядника перепризначено' : 'Підрядника призначено',
    );
  };

  const handleStart = () => {
    void runAction(
      'start',
      async () => { await updateApplicationStatus(application.id, 'in_progress'); },
      'Заявку переведено в роботу',
    );
  };

  const handleComplete = () => {
    void runAction(
      'complete',
      async () => { await updateApplicationStatus(application.id, 'completed'); },
      'Заявку виконано',
    );
  };

  const handleDeadline = () => {
    const iso = deadlineValue ? new Date(deadlineValue).toISOString() : null;
    void runAction(
      'deadline',
      () => updateApplicationDeadline(application.id, iso),
      deadlineValue ? 'Дедлайн оновлено' : 'Дедлайн прибрано',
    );
  };

  const handleProblem = () => {
    if (hasProblem) {
      void runAction('problem', () => resolveApplicationProblem(application.id), 'Проблему закрито');
      return;
    }
    void runAction(
      'problem',
      () => reportApplicationProblem(application.id, problemComment),
      'Проблему зафіксовано',
    );
  };

  const handleCancel = () => {
    if (!window.confirm('Скасувати цю заявку?')) return;
    void runAction('cancel', () => cancelApplication(application.id), 'Заявку скасовано');
  };

  const handleReopen = () => {
    void runAction('reopen', () => reopenApplication(application.id), 'Заявку повернуто в роботу');
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text) return;
    setBusy('comment');
    try {
      await insertApplicationComment(application.id, text);
      setCommentText('');
      showToast('Коментар додано', 'success');
      await loadExtra();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не вдалося додати коментар', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      fileInputRef.current?.click();
      return;
    }

    setBusy('upload');
    try {
      await uploadApplicationFile({
        applicationId: application.id,
        file: selectedFile,
        category: fileCategory,
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast('Файл додано до заявки', 'success');
      await loadExtra();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не вдалося завантажити файл', 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteFile = async (file: ApplicationFile) => {
    if (!window.confirm(`Видалити «${file.fileName}»?`)) return;
    setBusy(`delete-file-${file.id}`);
    try {
      await deleteApplicationFile(file);
      showToast('Файл видалено', 'success');
      await loadExtra();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Не вдалося видалити файл', 'error');
    } finally {
      setBusy(null);
    }
  };

  const groupedFiles = useMemo(() => {
    return (['before', 'after', 'document', 'other'] as ApplicationMediaCategory[]).map((category) => ({
      category,
      files: files.filter((file) => file.category === category),
    }));
  }, [files]);

  return (
    <div className="fixed inset-0 z-[120]">
      <button
        aria-label="Закрити"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-white/10 bg-[#0d131c] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-blue-400">{application.number}</span>
              <StatusBadge label={application.status} className={getApplicationStatusColor(application.status)} />
              {hasProblem && (
                <span className="rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                  ⚠ Проблема
                </span>
              )}
            </div>
            <h2 className="mt-1 truncate text-lg font-bold text-white">{application.customer}</h2>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{application.address}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-white">
            <X size={19} />
          </button>
        </header>

        <div className="grid grid-cols-3 border-b border-white/10 bg-[#0a1018] p-2">
          {([
            ['actions', 'Дії'],
            ['media', 'Фото / файли'],
            ['timeline', 'Таймлайн'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition ${tab === id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" /> Завантаження…
            </div>
          ) : tab === 'actions' ? (
            <div className="space-y-5">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Швидкі дії</h3>
                  <button onClick={() => void refreshAll()} className="flex items-center gap-1 text-xs text-slate-500 hover:text-white">
                    <RefreshCw size={13} /> Оновити
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    onClick={handleStart}
                    disabled={busy !== null || application.status === 'В роботі' || isFinished}
                    className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-blue-500/20 bg-blue-500/[0.07] text-xs font-semibold text-blue-300 disabled:opacity-35"
                  >
                    {busy === 'start' ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />}
                    В роботу
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={busy !== null || application.status === 'Виконана' || application.status === 'Скасована'}
                    className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] text-xs font-semibold text-emerald-300 disabled:opacity-35"
                  >
                    {busy === 'complete' ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                    Виконана
                  </button>
                  {application.status === 'Скасована' ? (
                    <button
                      onClick={handleReopen}
                      disabled={busy !== null}
                      className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-violet-500/20 bg-violet-500/[0.07] text-xs font-semibold text-violet-300 disabled:opacity-35"
                    >
                      {busy === 'reopen' ? <Loader2 size={20} className="animate-spin" /> : <RotateCcw size={20} />}
                      Повернути
                    </button>
                  ) : (
                    <button
                      onClick={handleCancel}
                      disabled={busy !== null || application.status === 'Виконана'}
                      className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] text-xs font-semibold text-rose-300 disabled:opacity-35"
                    >
                      {busy === 'cancel' ? <Loader2 size={20} className="animate-spin" /> : <XCircle size={20} />}
                      Скасувати
                    </button>
                  )}
                  <button
                    onClick={() => setTab('media')}
                    className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.07] text-xs font-semibold text-cyan-300"
                  >
                    <ImageIcon size={20} />
                    Фото / файл
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <UserRoundCheck size={16} className="text-blue-400" /> Підрядник
                </h3>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={contractorId}
                    onChange={(event) => setContractorId(event.target.value)}
                    className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#0b1018] px-3 text-sm text-slate-200 outline-none focus:border-blue-500/50"
                  >
                    <option value="">Не призначено</option>
                    {contractors.filter((item) => item.status === 'active').map((item) => (
                      <option key={item.id} value={item.id}>{item.name}{item.phone ? ` • ${item.phone}` : ''}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssign}
                    disabled={!contractorId || busy !== null || contractorId === application.contractorId}
                    className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busy === 'assign' ? 'Збереження…' : application.contractorId ? 'Перепризначити' : 'Призначити'}
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <CalendarClock size={16} className="text-amber-400" /> Дедлайн
                </h3>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="datetime-local"
                    value={deadlineValue}
                    onChange={(event) => setDeadlineValue(event.target.value)}
                    className="min-h-11 flex-1 rounded-xl border border-white/10 bg-[#0b1018] px-3 text-sm text-slate-200 outline-none focus:border-amber-500/50"
                  />
                  <button onClick={handleDeadline} disabled={busy !== null} className="min-h-11 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 text-sm font-semibold text-amber-300 disabled:opacity-40">
                    {busy === 'deadline' ? 'Збереження…' : 'Зберегти'}
                  </button>
                </div>
              </section>

              <section className={`rounded-2xl border p-4 ${hasProblem ? 'border-rose-500/30 bg-rose-500/[0.07]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <AlertTriangle size={16} className={hasProblem ? 'text-rose-400' : 'text-slate-500'} /> Проблема
                </h3>
                {!hasProblem && (
                  <textarea
                    value={problemComment}
                    onChange={(event) => setProblemComment(event.target.value)}
                    rows={3}
                    placeholder="Наприклад: підрядник не може потрапити на обʼєкт…"
                    className="w-full resize-none rounded-xl border border-white/10 bg-[#0b1018] px-3 py-2.5 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-rose-500/40"
                  />
                )}
                {hasProblem && <p className="mb-3 text-sm text-rose-200">{problemComment || 'Потрібна увага менеджера'}</p>}
                <button
                  onClick={handleProblem}
                  disabled={busy !== null || (!hasProblem && !problemComment.trim())}
                  className={`mt-2 min-h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-40 ${hasProblem ? 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border border-rose-500/20 bg-rose-500/10 text-rose-300'}`}
                >
                  {busy === 'problem' ? 'Збереження…' : hasProblem ? '✓ Проблему вирішено' : 'Позначити проблему'}
                </button>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <MessageSquarePlus size={16} className="text-violet-400" /> Внутрішні коментарі
                </h3>
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {comments.length === 0 && <p className="text-xs text-slate-600">Коментарів ще немає</p>}
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-[#0a1018] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-300">{comment.adminName}</span>
                        <span className="text-[10px] text-slate-600">{formatDateTime(comment.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{comment.message}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleComment(); } }}
                    placeholder="Додати коментар…"
                    className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0b1018] px-3 text-sm text-slate-200 outline-none focus:border-violet-500/40"
                  />
                  <button onClick={() => void handleComment()} disabled={!commentText.trim() || busy !== null} className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-40">
                    {busy === 'comment' ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                  </button>
                </div>
              </section>
            </div>
          ) : tab === 'media' ? (
            <div className="space-y-5">
              <section className="rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.04] p-4">
                <h3 className="text-sm font-semibold text-white">Додати фото або документ</h3>
                <p className="mt-1 text-xs text-slate-500">Файли зберігаються приватно. Максимум 20 МБ.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                  <select
                    value={fileCategory}
                    onChange={(event) => setFileCategory(event.target.value as ApplicationMediaCategory)}
                    className="min-h-11 rounded-xl border border-white/10 bg-[#0b1018] px-3 text-sm text-slate-200"
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-11 truncate rounded-xl border border-white/10 bg-white/[0.03] px-3 text-left text-sm text-slate-400"
                  >
                    {selectedFile?.name || 'Оберіть файл…'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  <button
                    onClick={() => void handleUpload()}
                    disabled={busy !== null}
                    className="min-h-11 rounded-xl bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busy === 'upload' ? <Loader2 size={17} className="animate-spin" /> : 'Завантажити'}
                  </button>
                </div>
              </section>

              {groupedFiles.map(({ category, files: categoryFiles }) => (
                <section key={category}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{categoryLabels[category]}</h3>
                    <span className="text-[11px] text-slate-600">{categoryFiles.length}</span>
                  </div>
                  {categoryFiles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-slate-600">Немає файлів</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {categoryFiles.map((file) => {
                        const isImage = file.fileType.startsWith('image/');
                        return (
                          <div key={file.id} className="group overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
                            <a href={file.url || '#'} target="_blank" rel="noreferrer" className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#080d14]">
                              {isImage && file.url ? (
                                <img src={file.url} alt={file.fileName} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                              ) : (
                                <FileText size={28} className="text-slate-600" />
                              )}
                            </a>
                            <div className="flex items-center gap-2 p-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-slate-300">{file.fileName}</p>
                                <p className="mt-0.5 text-[10px] text-slate-600">{formatDateTime(file.createdAt)}</p>
                              </div>
                              <button
                                onClick={() => void handleDeleteFile(file)}
                                disabled={busy !== null}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-500/10 hover:text-rose-400"
                                title="Видалити"
                              >
                                {busy === `delete-file-${file.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Історія заявки</h3>
                  <p className="mt-0.5 text-xs text-slate-600">Усі важливі зміни в одному місці</p>
                </div>
                <span className="text-xs text-slate-600">{events.length + legacyHistory.length} подій</span>
              </div>

              <div className="relative space-y-2 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-white/10">
                {events.length === 0 && legacyHistory.length === 0 && (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-600">Історія поки порожня</div>
                )}
                {events.map((event) => (
                  <div key={event.id} className="relative flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#0d131c]">
                      {eventIcon(event.eventType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-1">
                        <p className="text-sm font-medium text-slate-200">{event.title}</p>
                        <span className="text-[10px] text-slate-600">{formatDateTime(event.createdAt)}</span>
                      </div>
                      {event.description && <p className="mt-1 text-xs leading-5 text-slate-500">{event.description}</p>}
                      <p className="mt-1 text-[10px] text-slate-700">{event.actorName || 'Система'}</p>
                    </div>
                  </div>
                ))}
                {legacyHistory.map((entry) => (
                  <div key={`legacy-${entry.id}`} className="relative flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/15 bg-[#0d131c]">
                      <CheckCircle2 size={15} className="text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-1">
                        <p className="text-sm font-medium text-slate-200">{entry.title}</p>
                        <span className="text-[10px] text-slate-600">{formatDateTime(entry.completedAt)}</span>
                      </div>
                      {entry.description && <p className="mt-1 text-xs text-slate-500">{entry.description}</p>}
                      <p className="mt-1 text-[10px] text-slate-700">Історія робіт</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

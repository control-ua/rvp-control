import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crown,
  KeyRound,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';

import PageHeader from '@/components/PageHeader';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { tryCreateAuditLog } from '@/lib/auditLogApi';

type AdminRole = 'owner' | 'admin';

type AdminUser = {
  user_id: string;
  full_name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
};

type ModalState =
  | { type: 'password'; admin: AdminUser }
  | { type: 'delete'; admin: AdminUser }
  | null;

async function callAdminApi(
  body: Record<string, unknown>
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error(
      'Сесія відсутня. Увійдіть повторно.'
    );
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          `Bearer ${session.access_token}`,
        apikey:
          import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        'Помилка виконання операції'
    );
  }

  return data;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function RoleBadge({
  role,
}: {
  role: AdminRole;
}) {
  const owner = role === 'owner';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
        owner
          ? 'bg-amber-500/10 text-amber-400'
          : 'bg-blue-500/10 text-blue-400'
      }`}
    >
      {owner ? (
        <Crown size={12} />
      ) : (
        <ShieldCheck size={12} />
      )}

      {owner ? 'Owner' : 'Admin'}
    </span>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-red-500/10 text-red-400'
      }`}
    >
      {active ? 'Активний' : 'Вимкнений'}
    </span>
  );
}

export default function Administrators() {
  const { showToast } = useApp();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('admin');

  const [modal, setModal] = useState<ModalState>(null);
  const [newPassword, setNewPassword] = useState('');

  const loadAdmins = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setCurrentUserId(
        session?.user?.id || null
      );

      const result = await callAdminApi({
        action: 'list',
      });

      const rowsSource =
        Array.isArray(result)
          ? result
          : result?.admins ||
            result?.users ||
            result?.data ||
            result?.items ||
            [];

      const rows = Array.isArray(rowsSource)
        ? (rowsSource as AdminUser[])
        : [];

      console.log('admin-users list response:', result);
      setAdmins(rows);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Не вдалося завантажити адміністраторів';

      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const activeOwners = useMemo(
    () =>
      admins.filter(
        (admin) =>
          admin.role === 'owner' &&
          admin.is_active
      ),
    [admins]
  );

  const resetCreateForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('admin');
  };

  const handleCreate = async () => {
    if (
      !fullName.trim() ||
      !email.trim() ||
      !password
    ) {
      showToast(
        'Заповніть імʼя, email та пароль',
        'error'
      );
      return;
    }

    if (password.length < 8) {
      showToast(
        'Пароль має містити мінімум 8 символів',
        'error'
      );
      return;
    }

    setActionLoading('create');

    try {
      const result = await callAdminApi({
        action: 'create',
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });

      const createdUserId =
        result?.user_id ||
        result?.user?.id ||
        result?.admin?.user_id ||
        null;

      await tryCreateAuditLog({
        action: 'administrator_created',
        entityType: 'administrator',
        entityId: createdUserId,
        title: 'Створено адміністратора',
        description: `${fullName.trim()} • ${email.trim()} • ${
          role === 'owner' ? 'Owner' : 'Admin'
        }`,
        metadata: {
          target_user_id: createdUserId,
          full_name: fullName.trim(),
          email: email.trim(),
          role,
        },
      });

      showToast(
        'Адміністратора створено',
        'success'
      );

      resetCreateForm();
      setShowCreate(false);
      await loadAdmins();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Не вдалося створити адміністратора',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (
    admin: AdminUser
  ) => {
    const newActive = !admin.is_active;

    setActionLoading(
      `active:${admin.user_id}`
    );

    try {
      await callAdminApi({
        action: 'set_active',
        user_id: admin.user_id,
        is_active: newActive,
      });

      await tryCreateAuditLog({
        action: newActive
          ? 'administrator_enabled'
          : 'administrator_disabled',
        entityType: 'administrator',
        entityId: admin.user_id,
        title: newActive
          ? 'Адміністратора увімкнено'
          : 'Адміністратора вимкнено',
        description: `${admin.full_name} • ${admin.email}`,
        metadata: {
          target_user_id: admin.user_id,
          full_name: admin.full_name,
          email: admin.email,
          old_is_active: admin.is_active,
          new_is_active: newActive,
        },
      });

      showToast(
        newActive
          ? 'Адміністратора увімкнено'
          : 'Адміністратора вимкнено',
        'success'
      );

      await loadAdmins();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Не вдалося змінити статус',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (
    admin: AdminUser,
    newRole: AdminRole
  ) => {
    if (newRole === admin.role) return;

    setActionLoading(
      `role:${admin.user_id}`
    );

    try {
      await callAdminApi({
        action: 'change_role',
        user_id: admin.user_id,
        role: newRole,
      });

      await tryCreateAuditLog({
        action: 'role_changed',
        entityType: 'administrator',
        entityId: admin.user_id,
        title: 'Змінено роль адміністратора',
        description: `${admin.full_name}: ${
          admin.role === 'owner' ? 'Owner' : 'Admin'
        } → ${
          newRole === 'owner' ? 'Owner' : 'Admin'
        }`,
        metadata: {
          target_user_id: admin.user_id,
          full_name: admin.full_name,
          email: admin.email,
          old_role: admin.role,
          new_role: newRole,
        },
      });

      showToast(
        'Роль адміністратора змінено',
        'success'
      );

      await loadAdmins();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Не вдалося змінити роль',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangePassword = async () => {
    if (!modal || modal.type !== 'password') {
      return;
    }

    if (newPassword.length < 8) {
      showToast(
        'Пароль має містити мінімум 8 символів',
        'error'
      );
      return;
    }

    const admin = modal.admin;

    setActionLoading(
      `password:${admin.user_id}`
    );

    try {
      await callAdminApi({
        action: 'change_password',
        user_id: admin.user_id,
        password: newPassword,
      });

      await tryCreateAuditLog({
        action: 'password_changed',
        entityType: 'administrator',
        entityId: admin.user_id,
        title: 'Змінено пароль адміністратора',
        description: `${admin.full_name} • ${admin.email}`,
        metadata: {
          target_user_id: admin.user_id,
          full_name: admin.full_name,
          email: admin.email,
        },
      });

      showToast(
        'Пароль змінено',
        'success'
      );

      setNewPassword('');
      setModal(null);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Не вдалося змінити пароль',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!modal || modal.type !== 'delete') {
      return;
    }

    const admin = modal.admin;

    setActionLoading(
      `delete:${admin.user_id}`
    );

    try {
      await callAdminApi({
        action: 'delete',
        user_id: admin.user_id,
      });

      await tryCreateAuditLog({
        action: 'administrator_deleted',
        entityType: 'administrator',
        entityId: admin.user_id,
        title: 'Видалено адміністратора',
        description: `${admin.full_name} • ${admin.email}`,
        metadata: {
          target_user_id: admin.user_id,
          full_name: admin.full_name,
          email: admin.email,
          role: admin.role,
        },
      });

      showToast(
        'Адміністратора видалено',
        'success'
      );

      setModal(null);
      await loadAdmins();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Не вдалося видалити адміністратора',
        'error'
      );
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <PageHeader
        pageTitle="Адміністратори"
        pageSubtitle="Керування доступом до RVP Control"
        actions={
          <button
            onClick={() =>
              setShowCreate((value) => !value)
            }
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            <UserPlus size={16} />
            Додати адміністратора
          </button>
        }
      >
        {showCreate && (
          <div className="mb-5 rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">
                  Новий адміністратор
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  Створюється обліковий запис Supabase Auth
                </p>
              </div>

              <button
                onClick={() => {
                  setShowCreate(false);
                  resetCreateForm();
                }}
                className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                value={fullName}
                onChange={(event) =>
                  setFullName(event.target.value)
                }
                placeholder="Імʼя адміністратора"
                className="rounded-lg border border-white/10 bg-[#0f1219] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
              />

              <input
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Email / логін"
                type="email"
                className="rounded-lg border border-white/10 bg-[#0f1219] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
              />

              <input
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Пароль від 8 символів"
                type="password"
                className="rounded-lg border border-white/10 bg-[#0f1219] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
              />

              <select
                value={role}
                onChange={(event) =>
                  setRole(
                    event.target.value as AdminRole
                  )
                }
                className="rounded-lg border border-white/10 bg-[#0f1219] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
              >
                <option value="admin">
                  Admin
                </option>
                <option value="owner">
                  Owner
                </option>
              </select>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleCreate}
                disabled={
                  actionLoading === 'create'
                }
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {actionLoading === 'create' && (
                  <RefreshCw
                    size={14}
                    className="animate-spin"
                  />
                )}

                Створити
              </button>
            </div>
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/5 bg-[#141720] p-4">
            <p className="text-xs text-slate-500">
              Всього
            </p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {admins.length}
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#141720] p-4">
            <p className="text-xs text-slate-500">
              Активних
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">
              {
                admins.filter(
                  (admin) => admin.is_active
                ).length
              }
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-[#141720] p-4">
            <p className="text-xs text-slate-500">
              Owner
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-400">
              {activeOwners.length}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/5 bg-[#141720]">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Доступ до системи
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Owner може керувати адміністраторами
              </p>
            </div>

            <button
              onClick={loadAdmins}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-slate-200 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />
              Оновити
            </button>
          </div>

          <div className="overflow-x-auto mobile-no-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Адміністратор
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Роль
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Статус
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                    Створено
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">
                    Дії
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-14 text-center text-slate-500"
                    >
                      Завантаження...
                    </td>
                  </tr>
                ) : admins.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-14 text-center text-slate-500"
                    >
                      Адміністраторів не знайдено
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => {
                    const isSelf =
                      currentUserId ===
                      admin.user_id;

                    return (
                      <tr
                        key={admin.user_id}
                        className="border-b border-white/5 last:border-b-0"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                              <UserCog
                                size={16}
                                className="text-blue-400"
                              />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-200">
                                  {admin.full_name}
                                </p>

                                {isSelf && (
                                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">
                                    Ви
                                  </span>
                                )}
                              </div>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {admin.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <select
                            value={admin.role}
                            disabled={
                              isSelf ||
                              actionLoading ===
                                `role:${admin.user_id}`
                            }
                            onChange={(event) =>
                              handleRoleChange(
                                admin,
                                event.target
                                  .value as AdminRole
                              )
                            }
                            className="rounded-lg border border-white/5 bg-[#0f1219] px-2.5 py-2 text-xs text-slate-300 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="admin">
                              Admin
                            </option>
                            <option value="owner">
                              Owner
                            </option>
                          </select>

                          <div className="mt-2">
                            <RoleBadge
                              role={admin.role}
                            />
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            active={admin.is_active}
                          />
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                          {formatDate(
                            admin.created_at
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setNewPassword('');
                                setModal({
                                  type: 'password',
                                  admin,
                                });
                              }}
                              title="Змінити пароль"
                              className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-slate-500 transition hover:bg-white/5 hover:text-blue-400"
                            >
                              <KeyRound size={15} />
                            </button>

                            <button
                              onClick={() =>
                                handleToggleActive(
                                  admin
                                )
                              }
                              disabled={
                                isSelf ||
                                actionLoading ===
                                  `active:${admin.user_id}`
                              }
                              title={
                                admin.is_active
                                  ? 'Вимкнути'
                                  : 'Увімкнути'
                              }
                              className={`rounded-lg border p-2 transition disabled:cursor-not-allowed disabled:opacity-30 ${
                                admin.is_active
                                  ? 'border-white/5 bg-white/[0.03] text-slate-500 hover:bg-red-500/10 hover:text-red-400'
                                  : 'border-emerald-500/10 bg-emerald-500/[0.04] text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                            >
                              <Power size={15} />
                            </button>

                            <button
                              onClick={() =>
                                setModal({
                                  type: 'delete',
                                  admin,
                                })
                              }
                              disabled={isSelf}
                              title="Видалити"
                              className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PageHeader>

      {modal?.type === 'password' && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setModal(null)}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#141720] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">
                  Зміна пароля
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {modal.admin.full_name}
                </p>
              </div>

              <button
                onClick={() => setModal(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-300"
              >
                <X size={17} />
              </button>
            </div>

            <input
              autoFocus
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value
                )
              }
              placeholder="Новий пароль від 8 символів"
              className="mt-5 w-full rounded-lg border border-white/10 bg-[#0f1219] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500/50"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                Скасувати
              </button>

              <button
                onClick={handleChangePassword}
                disabled={
                  actionLoading ===
                  `password:${modal.admin.user_id}`
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                Змінити пароль
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.type === 'delete' && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setModal(null)}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-red-500/20 bg-[#141720] p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10">
              <Trash2
                size={20}
                className="text-red-400"
              />
            </div>

            <h3 className="mt-4 font-semibold text-white">
              Видалити адміністратора?
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Обліковий запис{' '}
              <span className="text-white">
                {modal.admin.full_name}
              </span>{' '}
              буде видалено з Supabase Auth та RVP Control.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setModal(null)}
                className="rounded-lg bg-white/5 px-4 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                Скасувати
              </button>

              <button
                onClick={handleDelete}
                disabled={
                  actionLoading ===
                  `delete:${modal.admin.user_id}`
                }
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

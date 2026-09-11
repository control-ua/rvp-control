import { supabase } from '@/lib/supabase';
import type { AdminUser, AdminRole } from '@/types';

export async function signIn(email: string, password: string): Promise<AdminUser> {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email, password,
  });

  if (authError) throw new Error(authError.message);
  if (!authData.session) throw new Error('Не вдалося увійти');

  const { data: admin, error: adminError } = await supabase
    .from('admin_users')
    .select('id, user_id, email, full_name, role, is_active')
    .eq('user_id', authData.session.user.id)
    .maybeSingle();

  if (adminError) throw new Error('Помилка перевірки доступу');
  if (!admin) throw new Error('Вас немає в системі. Зверніться до адміністратора.');
  if (!admin.is_active) throw new Error('Ваш акаунт deactivated. Зверніться до адміністратора.');

  return {
    id: admin.id,
    userId: admin.user_id,
    email: admin.email ?? email,
    fullName: admin.full_name ?? 'Адміністратор',
    role: admin.role as AdminRole,
    isActive: admin.is_active,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: admin } = await supabase
    .from('admin_users')
    .select('id, user_id, email, full_name, role, is_active')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!admin || !admin.is_active) return null;

  return {
    id: admin.id,
    userId: admin.user_id,
    email: admin.email ?? session.user.email ?? '',
    fullName: admin.full_name ?? 'Адміністратор',
    role: admin.role as AdminRole,
    isActive: admin.is_active,
  };
}

import { supabase } from '@/lib/supabase';
import type { ApplicationComment } from '@/types';

interface CommentRow {
  id: string;
  application_id: string;
  admin_user_id: string;
  message: string;
  created_at: string;
  admin: { full_name: string | null } | null;
}

function mapRow(row: CommentRow): ApplicationComment {
  return {
    id: row.id,
    applicationId: row.application_id,
    adminUserId: row.admin_user_id,
    adminName: row.admin?.full_name ?? 'Адміністратор',
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function fetchApplicationComments(applicationId: string): Promise<ApplicationComment[]> {
  const { data, error } = await supabase
    .from('application_comments')
    .select(`
      id, application_id, admin_user_id, message, created_at,
      admin:admin_users ( full_name )
    `)
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Не вдалося завантажити коментарі: ${error.message}`);
  return ((data ?? []) as unknown as CommentRow[]).map(mapRow);
}

export async function insertApplicationComment(applicationId: string, message: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Сесія відсутня');

  const { error } = await supabase
    .from('application_comments')
    .insert({
      application_id: applicationId,
      admin_user_id: session.user.id,
      message: message.trim(),
    });

  if (error) throw new Error(`Не вдалося додати коментар: ${error.message}`);
}

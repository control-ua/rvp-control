import { supabase } from '@/lib/supabase';

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  eventType: string;
  title: string;
  description: string | null;
  actorUserId: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ApplicationEventRow {
  id: string;
  application_id: string;
  event_type: string;
  title: string;
  description: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchApplicationEvents(
  applicationId: string,
): Promise<ApplicationEvent[]> {
  const { data, error } = await supabase
    .from('application_events')
    .select(
      'id, application_id, event_type, title, description, actor_user_id, actor_name, metadata, created_at',
    )
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Не вдалося завантажити таймлайн: ${error.message}`);
  }

  return ((data ?? []) as ApplicationEventRow[]).map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }));
}

export async function updateApplicationDeadline(
  applicationId: string,
  deadlineAt: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .update({
      deadline_at: deadlineAt,
      scheduled_at: deadlineAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  if (error) {
    throw new Error(`Не вдалося змінити дедлайн: ${error.message}`);
  }
}

export async function reportApplicationProblem(
  applicationId: string,
  comment: string,
): Promise<void> {
  const cleanComment = comment.trim();
  if (!cleanComment) throw new Error('Опишіть проблему.');

  const { error } = await supabase
    .from('applications')
    .update({
      has_problem: true,
      problem_comment: cleanComment,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  if (error) {
    throw new Error(`Не вдалося позначити проблему: ${error.message}`);
  }
}

export async function resolveApplicationProblem(
  applicationId: string,
): Promise<void> {
  const { error } = await supabase
    .from('applications')
    .update({
      has_problem: false,
      problem_comment: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  if (error) {
    throw new Error(`Не вдалося закрити проблему: ${error.message}`);
  }
}

export async function cancelApplication(applicationId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('applications')
    .update({
      status: 'cancelled',
      contractor_stage: 'cancelled',
      updated_at: now,
    })
    .eq('id', applicationId);

  if (error) {
    throw new Error(`Не вдалося скасувати заявку: ${error.message}`);
  }
}

export async function reopenApplication(applicationId: string): Promise<void> {
  const { data, error: readError } = await supabase
    .from('applications')
    .select('contractor_id')
    .eq('id', applicationId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Не вдалося перевірити заявку: ${readError.message}`);
  }

  const hasContractor = Boolean(data?.contractor_id);
  const { error } = await supabase
    .from('applications')
    .update({
      status: hasContractor ? 'assigned' : 'new',
      contractor_stage: hasContractor ? 'accepted' : 'unassigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId);

  if (error) {
    throw new Error(`Не вдалося повернути заявку в роботу: ${error.message}`);
  }
}

export async function fetchApplicationAttentionState(applicationId: string) {
  const { data, error } = await supabase
    .from('applications')
    .select('has_problem, problem_comment, contractor_stage, status, deadline_at')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Не вдалося оновити стан заявки: ${error.message}`);
  }

  return {
    hasProblem: Boolean(data?.has_problem),
    problemComment: data?.problem_comment ?? '',
    contractorStage: data?.contractor_stage ?? '',
    rawStatus: data?.status ?? '',
    deadlineAt: data?.deadline_at ?? null,
  };
}

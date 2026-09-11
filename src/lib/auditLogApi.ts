import { supabase } from '@/lib/supabase';

export type AuditEntityType =
  | 'application'
  | 'contractor'
  | 'act'
  | 'payout'
  | 'administrator'
  | 'system';

export type CreateAuditLogInput = {
  action: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function createAuditLog(
  input: CreateAuditLogInput
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
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-log`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        title: input.title,
        description: input.description ?? null,
        metadata: input.metadata ?? {},
      }),
    }
  );

  const data = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        'Не вдалося записати дію в журнал'
    );
  }

  return data;
}

/**
 * Використовуємо для дій, де помилка журналу
 * не повинна ламати основну операцію.
 */
export async function tryCreateAuditLog(
  input: CreateAuditLogInput
) {
  try {
    return await createAuditLog(input);
  } catch (error) {
    console.error(
      'Audit log error:',
      error
    );

    return null;
  }
}

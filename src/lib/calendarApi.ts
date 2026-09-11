import { supabase } from '@/lib/supabase';
import { normalizeStatus } from '@/utils/helpers';
import type { CalendarEvent } from '@/types';

interface AppRow {
  id: string;
  application_number: string | null;
  title: string;
  status: string;
  scheduled_at: string | null;
  deadline_at: string | null;
}

export async function fetchCalendarEvents(year: number, month: number): Promise<CalendarEvent[]> {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);

  const { data, error } = await supabase
    .from('applications')
    .select('id, application_number, title, status, scheduled_at, deadline_at')
    .or(`scheduled_at.gte.${start.toISOString()},deadline_at.gte.${start.toISOString()}`)
    .lte('created_at', end.toISOString())
    .limit(200);

  if (error) throw new Error(`Не вдалося завантажити календар: ${error.message}`);

  const rows = (data ?? []) as unknown as AppRow[];
  const events: CalendarEvent[] = [];

  for (const row of rows) {
    const ns = normalizeStatus(row.status);
    if (ns === 'Скасована') continue;

    if (row.scheduled_at) {
      events.push({
        id: `${row.id}-sched`,
        applicationId: row.id,
        number: row.application_number ?? '—',
        title: row.title ?? '—',
        status: ns,
        date: row.scheduled_at,
        deadline: false,
      });
    }
    if (row.deadline_at) {
      events.push({
        id: `${row.id}-deadline`,
        applicationId: row.id,
        number: row.application_number ?? '—',
        title: row.title ?? '—',
        status: ns,
        date: row.deadline_at,
        deadline: true,
      });
    }
  }

  return events;
}

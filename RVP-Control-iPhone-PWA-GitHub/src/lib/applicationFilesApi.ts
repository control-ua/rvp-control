import { supabase } from '@/lib/supabase';
import { telegramFileUrl } from '@/lib/actsApi';
import type { ApplicationFile } from '@/types';

interface FileRow {
  id: string;
  application_id: string;
  file_name: string | null;
  file_type: string;
  storage_path: string | null;
  telegram_file_id: string | null;
  category: string;
  uploaded_by: string | null;
  created_at: string;
}

function mapRow(row: FileRow): ApplicationFile {
  return {
    id: row.id,
    applicationId: row.application_id,
    fileName: row.file_name ?? '—',
    fileType: row.file_type,
    storagePath: row.storage_path,
    telegramFileId: row.telegram_file_id,
    category: (row.category as ApplicationFile['category']) ?? 'other',
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    url: row.telegram_file_id ? telegramFileUrl(row.telegram_file_id) : row.storage_path,
  };
}

export async function fetchApplicationFiles(applicationId: string): Promise<ApplicationFile[]> {
  const { data, error } = await supabase
    .from('application_files')
    .select('id, application_id, file_name, file_type, storage_path, telegram_file_id, category, uploaded_by, created_at')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Не вдалося завантажити файли: ${error.message}`);
  return ((data ?? []) as unknown as FileRow[]).map(mapRow);
}

export async function insertApplicationFile(input: {
  applicationId: string;
  fileName: string;
  fileType: string;
  telegramFileId?: string;
  storagePath?: string;
  category: ApplicationFile['category'];
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const { error } = await supabase
    .from('application_files')
    .insert({
      application_id: input.applicationId,
      file_name: input.fileName,
      file_type: input.fileType,
      telegram_file_id: input.telegramFileId ?? null,
      storage_path: input.storagePath ?? null,
      category: input.category,
      uploaded_by: session?.user?.id ?? null,
    });

  if (error) throw new Error(`Не вдалося додати файл: ${error.message}`);
}

export async function deleteApplicationFile(id: string): Promise<void> {
  const { error } = await supabase
    .from('application_files')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Не вдалося видалити файл: ${error.message}`);
}

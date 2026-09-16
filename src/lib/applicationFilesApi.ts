import { supabase } from '@/lib/supabase';
import { telegramFileUrl } from '@/lib/actsApi';

export type ApplicationMediaCategory = 'before' | 'after' | 'document' | 'other';

export interface ApplicationFile {
  id: string;
  applicationId: string;
  fileName: string;
  fileType: string;
  storagePath: string | null;
  telegramFileId: string | null;
  category: ApplicationMediaCategory;
  uploadedBy: string | null;
  createdAt: string;
  url: string | null;
}

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

const BUCKET = 'application-media';

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
}

async function resolveFileUrl(row: FileRow): Promise<string | null> {
  if (row.telegram_file_id) return telegramFileUrl(row.telegram_file_id);
  if (!row.storage_path) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, 60 * 60);

  if (error) return null;
  return data.signedUrl;
}

export async function fetchApplicationFiles(
  applicationId: string,
): Promise<ApplicationFile[]> {
  const { data, error } = await supabase
    .from('application_files')
    .select(
      'id, application_id, file_name, file_type, storage_path, telegram_file_id, category, uploaded_by, created_at',
    )
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Не вдалося завантажити файли: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as FileRow[];
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      applicationId: row.application_id,
      fileName: row.file_name ?? '—',
      fileType: row.file_type,
      storagePath: row.storage_path,
      telegramFileId: row.telegram_file_id,
      category: (row.category as ApplicationMediaCategory) || 'other',
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      url: await resolveFileUrl(row),
    })),
  );
}

export async function uploadApplicationFile(input: {
  applicationId: string;
  file: File;
  category: ApplicationMediaCategory;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Сесія завершилась. Увійдіть знову.');

  if (input.file.size > 20 * 1024 * 1024) {
    throw new Error('Максимальний розмір файлу — 20 МБ.');
  }

  const safeName = sanitizeFileName(input.file.name);
  const storagePath = `${input.applicationId}/${input.category}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: input.file.type || undefined,
    });

  if (uploadError) {
    throw new Error(`Не вдалося завантажити файл: ${uploadError.message}`);
  }

  const { error: metadataError } = await supabase
    .from('application_files')
    .insert({
      application_id: input.applicationId,
      file_name: input.file.name,
      file_type: input.file.type || 'application/octet-stream',
      telegram_file_id: null,
      storage_path: storagePath,
      category: input.category,
      uploaded_by: session.user.id,
    });

  if (metadataError) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => undefined);
    throw new Error(`Файл завантажено, але не вдалося зберегти запис: ${metadataError.message}`);
  }
}

export async function insertApplicationFile(input: {
  applicationId: string;
  fileName: string;
  fileType: string;
  telegramFileId?: string;
  storagePath?: string;
  category: ApplicationMediaCategory;
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

export async function deleteApplicationFile(file: Pick<ApplicationFile, 'id' | 'storagePath'>): Promise<void> {
  if (file.storagePath) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([file.storagePath]);

    if (storageError) {
      throw new Error(`Не вдалося видалити файл зі сховища: ${storageError.message}`);
    }
  }

  const { error } = await supabase
    .from('application_files')
    .delete()
    .eq('id', file.id);

  if (error) throw new Error(`Не вдалося видалити файл: ${error.message}`);
}

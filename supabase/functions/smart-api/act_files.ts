// Call only after verifying access to the act. Original binaries remain private.
export async function resolveActFiles(db: any, act: any) {
  const {data, error} = await db.from('act_files')
    .select('telegram_file_id,storage_path,file_type,file_name')
    .eq('act_id', act.id).order('created_at', {ascending:true});
  if(error) throw new Error('Не вдалося відкрити файли акта.');
  const rows = [...(data || [])];
  if(act.telegram_file_id && !rows.some(f => f.telegram_file_id === act.telegram_file_id))
    rows.unshift(act);
  return Promise.all(rows.map(async (f: any) => {
    if(f.storage_path) {
      const signed = await db.storage.from('application-media').createSignedUrl(f.storage_path,600);
      if(signed.error || !signed.data?.signedUrl) throw new Error('Файл акта недоступний.');
      // Send originals as documents, including HEIC and large photos.
      return {...f, file_type:'document', source:signed.data.signedUrl};
    }
    if(!f.telegram_file_id) throw new Error('Файл акта недоступний.');
    return {...f,source:f.telegram_file_id};
  }));
}

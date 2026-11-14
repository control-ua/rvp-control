import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

// Run the real upload/read code against the repository's Postgres constraint.
// Only authentication and the binary Storage service are replaced locally.
test('primary act upload persists metadata accepted by Postgres and remains readable', async () => {
  const db = new PGlite();
  const applicationId = '30000000-0000-0000-0000-000000000001';
  const userId = '10000000-0000-0000-0000-000000000001';
  const objects = new Map();
  let session = { user: { id: userId } };
  const migration = await fs.readFile(new URL('../supabase/migrations/20260907122556_create_application_files_comments_automation_roles.sql', import.meta.url), 'utf8');
  const table = migration.match(/CREATE TABLE IF NOT EXISTS public\.application_files[\s\S]*?\n\);/)[0];
  await db.exec(`create table applications(id uuid primary key); ${table}`);
  await db.query('insert into applications values ($1)', [applicationId]);
  const supabase = {
    auth: { getSession: async () => ({ data: { session } }) },
    storage: { from(bucket) {
      assert.equal(bucket, 'application-media');
      return {
        async upload(path, file) { objects.set(path, Buffer.from(await file.arrayBuffer())); return { error: null }; },
        async remove(paths) { paths.forEach(path => objects.delete(path)); return { error: null }; },
        async createSignedUrl(path) { assert.ok(objects.has(path)); return { data: { signedUrl: `https://storage.example.test/${path}` }, error: null }; },
      };
    } },
    from(name) {
      assert.equal(name, 'application_files');
      let filter;
      return {
        async insert(row) {
          const keys = Object.keys(row);
          try {
            await db.query(`insert into application_files (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')})`, Object.values(row));
            return { error: null };
          } catch (error) { return { error }; }
        },
        select() { return this; },
        eq(key, value) { assert.equal(key, 'application_id'); filter = value; return this; },
        async order() { return { data: (await db.query('select * from application_files where application_id=$1 order by created_at', [filter])).rows, error: null }; },
      };
    },
  };
  const source = await fs.readFile(new URL('../src/lib/applicationFilesApi.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const api = {};
  new Function('require', 'exports', compiled)(name => {
    if (name === '@/lib/supabase') return { supabase };
    if (name === '@/lib/actsApi') return { telegramFileUrl: () => { throw Error('Unexpected Telegram call'); } };
    throw Error(`Unexpected dependency: ${name}`);
  }, api);
  try {
    const file = new File(['%PDF-1.4\nsynthetic primary act'], 'Первинний акт.pdf', { type: 'application/pdf' });
    await api.uploadApplicationFile({ applicationId, file });
    const [saved] = (await db.query('select * from application_files')).rows;
    assert.equal(saved.category, 'act');
    assert.equal(saved.uploaded_by, userId);
    assert.equal(saved.file_name, file.name);
    assert.equal(objects.get(saved.storage_path).toString(), await file.text());
    const [visible] = await api.fetchApplicationFiles(applicationId);
    assert.equal(visible.id, saved.id);
    assert.equal(visible.url, `https://storage.example.test/${saved.storage_path}`);

    // Failed metadata writes must not report success or leave an orphan file.
    await assert.rejects(api.uploadApplicationFile({ applicationId: '30000000-0000-0000-0000-000000000099', file }), /не вдалося зберегти запис/);
    assert.equal(objects.size, 1);
    assert.equal((await db.query('select count(*)::int n from application_files')).rows[0].n, 1);
    session = null;
    await assert.rejects(api.uploadApplicationFile({ applicationId, file }), /Сесія завершилась/);
    assert.equal(objects.size, 1);
  } finally { await db.close(); }
});

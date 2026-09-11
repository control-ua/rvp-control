/*
# Enable RLS CRUD on contractors for the anon key

## Overview
The `contractors` table has RLS enabled but no policies, so the anon key
(frontend) cannot read or write any rows. This migration adds the four
per-CRUD-verb policies required by the RVP Admin frontend.

## Security changes
- `contractors`: SELECT policy `anon_read_contractors` — anon + authenticated can read all rows.
- `contractors`: INSERT policy `anon_insert_contractors` — anon + authenticated can insert rows.
- `contractors`: UPDATE policy `anon_update_contractors` — anon + authenticated can update rows.
- `contractors`: DELETE policy `anon_delete_contractors` — anon + authenticated can delete rows.

## No data changes
No rows are inserted, updated, or deleted by this migration.
*/

DROP POLICY IF EXISTS "anon_read_contractors" ON contractors;
CREATE POLICY "anon_read_contractors"
  ON contractors FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "anon_insert_contractors" ON contractors;
CREATE POLICY "anon_insert_contractors"
  ON contractors FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_contractors" ON contractors;
CREATE POLICY "anon_update_contractors"
  ON contractors FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_contractors" ON contractors;
CREATE POLICY "anon_delete_contractors"
  ON contractors FOR DELETE
  TO anon, authenticated
  USING (true);

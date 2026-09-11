/*
# Enable INSERT / UPDATE / DELETE on contractors for the anon key

## Overview
The RVP Admin frontend needs full CRUD on the `contractors` table: add new
contractors, edit existing ones, toggle active/inactive, and delete contractors
that have no linked applications. This migration adds the three missing
policies.

## Security changes
- `contractors`: new INSERT policy `anon_insert_contractors` allowing
  `anon, authenticated` to insert rows.
- `contractors`: new UPDATE policy `anon_update_contractors` allowing
  `anon, authenticated` to update rows.
- `contractors`: new DELETE policy `anon_delete_contractors` allowing
  `anon, authenticated` to delete rows.
- `applications`: unchanged.

## No data changes
No rows are inserted, updated, or deleted by this migration.
*/

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

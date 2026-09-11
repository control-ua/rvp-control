/*
# Enable INSERT on applications for the anon key (read-only -> create phase)

## Overview
The RVP Admin frontend now needs to create new applications. This migration
adds a single INSERT policy on the `applications` table scoped to the anon +
authenticated roles. No UPDATE or DELETE policies are added — the app remains
read-and-create only.

## Security changes
- `applications`: new INSERT policy `anon_insert_applications` allowing
  `anon, authenticated` to insert rows. WITH CHECK (true) because this is a
  shared/single-tenant table with no per-user ownership.
- `contractors`: unchanged — still SELECT-only.

## No data changes
No rows are inserted, updated, or deleted by this migration.
*/

DROP POLICY IF EXISTS "anon_insert_applications" ON applications;
CREATE POLICY "anon_insert_applications"
  ON applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

/*
# Ensure SELECT on applications for the anon key

## Overview
The `applications` table needs a SELECT policy so the frontend can count
linked applications per contractor and display contractor profiles.

## Security changes
- `applications`: SELECT policy `anon_read_applications`.

## No data changes
*/

DROP POLICY IF EXISTS "anon_read_applications" ON applications;
CREATE POLICY "anon_read_applications"
  ON applications FOR SELECT
  TO anon, authenticated
  USING (true);

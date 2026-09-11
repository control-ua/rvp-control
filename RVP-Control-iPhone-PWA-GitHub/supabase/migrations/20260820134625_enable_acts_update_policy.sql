/*
# Enable UPDATE on acts for the anon role

## Overview
The Acts page needs to approve/reject acts, which updates the
`status` and `reviewed_at` columns. RLS is enabled on `acts`
but only a SELECT policy existed.

## Security changes
- `acts`: UPDATE policy `anon_update_acts` — anon + authenticated
  can update any row. This is a management tool with no auth.

## No data changes
*/

DROP POLICY IF EXISTS "anon_update_acts" ON acts;
CREATE POLICY "anon_update_acts"
  ON acts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

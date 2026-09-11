/*
# Enable UPDATE on applications for the anon role

## Overview
The Payouts page needs to confirm payouts, which updates
`payout_status`, `paid_at`, and `payout_receipt_name` on
`public.applications`. RLS had SELECT + INSERT but no UPDATE.

## Security changes
- `applications`: UPDATE policy `anon_update_applications` —
  anon + authenticated can update any row.

## No data changes
*/

DROP POLICY IF EXISTS "anon_update_applications" ON applications;
CREATE POLICY "anon_update_applications"
  ON applications FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

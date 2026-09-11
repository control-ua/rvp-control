/*
# Enable SELECT on acts for the anon key

## Overview
The `acts` table has RLS enabled but no policies, so the frontend
cannot read any rows. This adds a SELECT policy so the Acts page
can load real act records.

## Security changes
- `acts`: SELECT policy `anon_read_acts` — anon + authenticated can read all rows.

## No data changes
*/

DROP POLICY IF EXISTS "anon_read_acts" ON acts;
CREATE POLICY "anon_read_acts"
  ON acts FOR SELECT
  TO anon, authenticated
  USING (true);

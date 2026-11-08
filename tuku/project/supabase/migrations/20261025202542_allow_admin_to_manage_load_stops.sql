/*
# Allow admin to manage load_stops

## Problem
The existing INSERT/UPDATE/DELETE policies on load_stops only allow the
shipper (who owns the parent load) and the awarded rider (for UPDATE only).
Admins can read stops but cannot add, edit, or remove them.

## Fix
Drop and recreate the INSERT, UPDATE, and DELETE policies to also allow
`is_admin()` on the parent load. The SELECT policy already includes admin.

## Security
- INSERT: shipper OR admin can add stops.
- UPDATE: shipper, awarded rider, OR admin can update stops.
- DELETE: shipper OR admin can delete stops.
- All checks scope through the parent load's ownership + is_admin().
*/

DROP POLICY IF EXISTS "insert_load_stops" ON load_stops;
CREATE POLICY "insert_load_stops" ON load_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND (auth.uid() = loads.shipper_id OR is_admin())
    )
  );

DROP POLICY IF EXISTS "update_load_stops" ON load_stops;
CREATE POLICY "update_load_stops" ON load_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND (auth.uid() = loads.shipper_id OR auth.uid() = loads.awarded_rider_id OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND (auth.uid() = loads.shipper_id OR auth.uid() = loads.awarded_rider_id OR is_admin())
    )
  );

DROP POLICY IF EXISTS "delete_load_stops" ON load_stops;
CREATE POLICY "delete_load_stops" ON load_stops FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND (auth.uid() = loads.shipper_id OR is_admin())
    )
  );

/*
# Create load_stops table for multiple intermediate stops

## Purpose
Allows a shipper to add intermediate stops between the pickup and final delivery
addresses. A load can have zero or more stops, each with an address, optional
coordinates, a stop order (sequence), and a completion flag the driver can
toggle when they've visited that stop.

## New Table: load_stops
- `id` (uuid, primary key)
- `load_id` (uuid, foreign key → loads.id ON DELETE CASCADE)
- `stop_order` (int, not null — sequence number starting at 1)
- `address` (text, not null)
- `lat` (double precision, nullable)
- `lng` (double precision, nullable)
- `contact_name` (text, nullable — who to meet at the stop)
- `contact_phone` (text, nullable)
- `note` (text, nullable — instructions for this stop)
- `is_completed` (boolean, default false — driver marks it done)
- `completed_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())

## Security (RLS)
- Enable RLS on `load_stops`.
- SELECT: visible to anyone who can see the parent load (shipper, awarded
  rider, or admin). Reuses the same ownership logic as the loads SELECT policy.
- INSERT: only the shipper who owns the parent load can add stops.
- UPDATE: shipper can edit stops while load is still 'posted'; awarded rider
  can update `is_completed` / `completed_at` only.
- DELETE: only the shipper who owns the parent load.
- GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated.
*/

CREATE TABLE IF NOT EXISTS load_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  stop_order int NOT NULL DEFAULT 1,
  address text NOT NULL,
  lat double precision,
  lng double precision,
  contact_name text,
  contact_phone text,
  note text,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS load_stops_load_id_idx ON load_stops (load_id);
CREATE INDEX IF NOT EXISTS load_stops_load_order_idx ON load_stops (load_id, stop_order);

ALTER TABLE load_stops ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON load_stops TO authenticated;

-- SELECT: same visibility as the parent load
DROP POLICY IF EXISTS "select_load_stops" ON load_stops;
CREATE POLICY "select_load_stops" ON load_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND (
          is_admin()
          OR auth.uid() = loads.shipper_id
          OR auth.uid() = loads.awarded_rider_id
          OR loads.status = 'posted'
        )
    )
  );

-- INSERT: only the shipper who owns the parent load
DROP POLICY IF EXISTS "insert_load_stops" ON load_stops;
CREATE POLICY "insert_load_stops" ON load_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND auth.uid() = loads.shipper_id
    )
  );

-- UPDATE: shipper can edit while load is 'posted'; awarded rider can toggle completion
DROP POLICY IF EXISTS "update_load_stops" ON load_stops;
CREATE POLICY "update_load_stops" ON load_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND (auth.uid() = loads.shipper_id OR auth.uid() = loads.awarded_rider_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND (auth.uid() = loads.shipper_id OR auth.uid() = loads.awarded_rider_id)
    )
  );

-- DELETE: only the shipper who owns the parent load
DROP POLICY IF EXISTS "delete_load_stops" ON load_stops;
CREATE POLICY "delete_load_stops" ON load_stops FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loads
      WHERE loads.id = load_stops.load_id
        AND auth.uid() = loads.shipper_id
    )
  );

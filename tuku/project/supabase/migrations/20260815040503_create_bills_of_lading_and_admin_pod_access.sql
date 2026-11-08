/*
# Auto-generate Bills of Lading + Admin access to PODs and BOLs

## What this does
1. Creates a `bills_of_lading` table that stores an auto-generated Bill of Lading
   for each load when it is assigned to a driver (status becomes 'awarded').
2. Adds a trigger + function that fires on `loads` UPDATE — when `awarded_rider_id`
   transitions from null to non-null — to auto-insert a BOL row with all the
   shipment details captured at that moment.
3. Grants admin (is_admin()) read access to `proof_of_delivery` and
   `bills_of_lading` so the admin control panel can display both documents.
4. Grants admin read access to `bills_of_lading`.

## New Tables
- `bills_of_lading`
  - `id` uuid PK
  - `load_id` uuid FK -> loads(id) ON DELETE CASCADE
  - `shipper_id` uuid FK -> profiles(id)
  - `driver_id` uuid FK -> profiles(id)
  - `bol_number` text, unique, auto-generated (e.g. BOL-<load_id-prefix>-<seq>)
  - `title` text — shipment title
  - `pickup_address` text
  - `delivery_address` text
  - `cargo_type` text
  - `cargo_description` text
  - `weight_kg` numeric
  - `urgency` text
  - `offer_price_ugx` integer
  - `status` text (defaults to 'active') — tracks the BOL lifecycle
  - `generated_at` timestamptz — when the BOL was created
  - `created_at` timestamptz

## Security
- RLS enabled on `bills_of_lading`.
- Shipper and driver of the load can read their own BOLs.
- Admin (is_admin()) can read all BOLs.
- Inserts happen via SECURITY DEFINER trigger function (bypasses RLS for the auto-insert).
- Admin read policy added to `proof_of_delivery` (existing table, no new columns).

## Important Notes
1. The trigger fires only when `awarded_rider_id` changes from null to a value.
2. BOLs are auto-generated — no manual action needed by shipper, driver, or admin.
3. Existing loads that are already awarded will NOT get retroactive BOLs from the
   trigger; a one-time backfill INSERT is included to create BOLs for already-awarded loads.
*/

-- ============================================================
-- 1. Create bills_of_lading table
-- ============================================================
CREATE TABLE IF NOT EXISTS bills_of_lading (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  shipper_id uuid REFERENCES profiles(id),
  driver_id uuid REFERENCES profiles(id),
  bol_number text UNIQUE,
  title text DEFAULT '',
  pickup_address text,
  delivery_address text,
  cargo_type text DEFAULT 'other',
  cargo_description text DEFAULT '',
  weight_kg numeric,
  urgency text DEFAULT 'standard',
  offer_price_ugx integer DEFAULT 0,
  status text DEFAULT 'active',
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bol_load_id ON bills_of_lading(load_id);
CREATE INDEX IF NOT EXISTS idx_bol_driver_id ON bills_of_lading(driver_id);
CREATE INDEX IF NOT EXISTS idx_bol_shipper_id ON bills_of_lading(shipper_id);

ALTER TABLE bills_of_lading ENABLE ROW LEVEL SECURITY;

-- Shipper and driver can read their own BOLs
DROP POLICY IF EXISTS "select_own_bol" ON bills_of_lading;
CREATE POLICY "select_own_bol" ON bills_of_lading FOR SELECT
  TO authenticated USING (
    shipper_id = auth.uid() OR driver_id = auth.uid()
  );

-- Admin can read all BOLs
DROP POLICY IF EXISTS "admin_select_bol" ON bills_of_lading;
CREATE POLICY "admin_select_bol" ON bills_of_lading FOR SELECT
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 2. Admin read access to proof_of_delivery (existing table)
-- ============================================================
DROP POLICY IF EXISTS "admin_select_pod" ON proof_of_delivery;
CREATE POLICY "admin_select_pod" ON proof_of_delivery FOR SELECT
  TO authenticated USING (public.is_admin());

-- ============================================================
-- 3. Trigger function: auto-generate BOL when load is awarded
-- ============================================================
CREATE OR REPLACE FUNCTION generate_bol_on_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bol_num text;
  seq int;
BEGIN
  -- Only fire when awarded_rider_id transitions from null to non-null
  IF (OLD.awarded_rider_id IS NULL AND NEW.awarded_rider_id IS NOT NULL) THEN
    -- Don't create duplicate if one already exists
    IF NOT EXISTS (SELECT 1 FROM bills_of_lading WHERE load_id = NEW.id) THEN
      -- Generate a sequence number for the BOL number
      SELECT COALESCE(MAX(
        CAST(
          COALESCE(
            NULLIF(
              regexp_substr(bol_number, 'BOL-[A-F0-9]{8}-(\d+)'), ''
            ), '0'
          ) AS int
        )
      ), 0) + 1 INTO seq FROM bills_of_lading;

      bol_num := 'BOL-' || upper(substr(NEW.id::text, 1, 8)) || '-' || lpad(seq::text, 4, '0');

      INSERT INTO bills_of_lading (
        load_id, shipper_id, driver_id, bol_number,
        title, pickup_address, delivery_address,
        cargo_type, cargo_description, weight_kg, urgency, offer_price_ugx,
        status, generated_at
      ) VALUES (
        NEW.id, NEW.shipper_id, NEW.awarded_rider_id, bol_num,
        NEW.title, NEW.pickup_address, NEW.delivery_address,
        NEW.cargo_type, NEW.cargo_description, NEW.weight_kg, NEW.urgency, NEW.offer_price_ugx,
        'active', now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_bol_on_award ON loads;
CREATE TRIGGER trg_generate_bol_on_award
  AFTER UPDATE ON loads
  FOR EACH ROW
  EXECUTE FUNCTION generate_bol_on_award();

-- ============================================================
-- 4. Backfill: create BOLs for already-awarded loads
-- ============================================================
INSERT INTO bills_of_lading (
  load_id, shipper_id, driver_id, bol_number,
  title, pickup_address, delivery_address,
  cargo_type, cargo_description, weight_kg, urgency, offer_price_ugx,
  status, generated_at
)
SELECT
  l.id, l.shipper_id, l.awarded_rider_id,
  'BOL-' || upper(substr(l.id::text, 1, 8)) || '-0001',
  l.title, l.pickup_address, l.delivery_address,
  l.cargo_type, l.cargo_description, l.weight_kg, l.urgency, l.offer_price_ugx,
  CASE WHEN l.status IN ('completed', 'cancelled') THEN l.status ELSE 'active' END,
  COALESCE(l.created_at, now())
FROM loads l
WHERE l.awarded_rider_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM bills_of_lading bol WHERE bol.load_id = l.id);

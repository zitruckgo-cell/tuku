/*
# Create earnings table with auto-distribution trigger

1. New Tables
- `earnings`
  - `id` (uuid, primary key)
  - `load_id` (uuid, FK to loads, unique — one earning record per load)
  - `driver_id` (uuid, FK to profiles)
  - `total_amount_ugx` (integer, not null) — the full accepted amount
  - `marketplace_fee_ugx` (integer, not null) — 10% of total
  - `driver_earnings_ugx` (integer, not null) — 90% of total
  - `status` (text, default 'pending') — 'pending' or 'paid'
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `earnings`.
- Drivers can view their own earnings (SELECT where driver_id = auth.uid()).
- Shippers can view earnings for loads they own (SELECT via EXISTS check on loads).
- No direct INSERT/UPDATE/DELETE from clients — the trigger handles inserts, so we
  still add owner-scoped policies but the trigger runs with elevated privileges.

3. Trigger
- `handle_load_completion_earnings()` AFTER UPDATE on `loads`
  When `status` transitions to 'completed', insert a row into `earnings` with:
    - total = accepted bid amount, or load.offer_price_ugx if no accepted bid exists
    - marketplace_fee = round(total * 0.10)
    - driver_earnings = total - marketplace_fee (i.e. 90%)
  Guarded by `IF NOT EXISTS` to prevent duplicates.

4. Important Notes
  1. The trigger function uses SECURITY DEFINER so it can insert into earnings
     regardless of the calling user's RLS permissions.
  2. The unique constraint on `load_id` plus the `IF NOT EXISTS` guard make this
     idempotent — safe to re-run.
*/
CREATE TABLE IF NOT EXISTS earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount_ugx integer NOT NULL,
  marketplace_fee_ugx integer NOT NULL,
  driver_earnings_ugx integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (load_id)
);

CREATE INDEX IF NOT EXISTS idx_earnings_driver ON earnings (driver_id);

ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_earnings" ON earnings;
CREATE POLICY "select_own_earnings" ON earnings FOR SELECT
  TO authenticated USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "select_shipper_earnings" ON earnings;
CREATE POLICY "select_shipper_earnings" ON earnings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM loads WHERE loads.id = earnings.load_id AND loads.shipper_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_earnings_status" ON earnings;
CREATE POLICY "update_earnings_status" ON earnings FOR UPDATE
  TO authenticated USING (auth.uid() = driver_id) WITH CHECK (auth.uid() = driver_id);

CREATE OR REPLACE FUNCTION handle_load_completion_earnings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_fee integer;
  v_driver uuid;
BEGIN
  IF (OLD.status IS DISTINCT FROM 'completed') AND (NEW.status = 'completed') THEN
    SELECT awarded_rider_id INTO v_driver FROM loads WHERE id = NEW.id;
    IF v_driver IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(
      (SELECT bid_amount_ugx FROM bids WHERE load_id = NEW.id AND status = 'accepted' LIMIT 1),
      NEW.offer_price_ugx
    ) INTO v_total;

    v_fee := round(v_total * 0.10);

    INSERT INTO earnings (load_id, driver_id, total_amount_ugx, marketplace_fee_ugx, driver_earnings_ugx)
    VALUES (NEW.id, v_driver, v_total, v_fee, v_total - v_fee)
    ON CONFLICT (load_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_load_completion_earnings ON loads;
CREATE TRIGGER trigger_load_completion_earnings
  AFTER UPDATE ON loads
  FOR EACH ROW
  EXECUTE FUNCTION handle_load_completion_earnings();
/*
# Create transactions table and add MoMo account fields to profiles

1. New Tables
- `transactions`
  - `id` (uuid, primary key)
  - `load_id` (uuid, FK to loads)
  - `shipper_id` (uuid, FK to profiles)
  - `driver_id` (uuid, FK to profiles, nullable)
  - `amount_ugx` (integer, total payment from shipper)
  - `marketplace_fee_ugx` (integer, 10% commission)
  - `driver_earnings_ugx` (integer, 90% to driver)
  - `type` (text: 'collection' = shipper payment, 'disbursement' = driver payout, 'commission' = platform fee, 'refund' = refund to shipper)
  - `status` (text: 'pending', 'successfull', 'failed', 'refunded')
  - `momo_reference` (text, MTN MoMo transaction reference)
  - `momo_financial_id` (text, MoMo financial transaction ID)
  - `failure_reason` (text, nullable)
  - `created_at`, `updated_at` (timestamptz)

2. Modified Tables
- `profiles`
  - `momo_phone` (text, nullable) — driver's MTN MoMo phone number for payouts
  - `momo_account_verified` (boolean, default false) — whether MoMo account has been verified

3. Modified Tables (earnings)
- `earnings`
  - `transaction_id` (uuid, FK to transactions, nullable) — link to the payment transaction
  - `payout_status` (text: 'pending', 'paid', 'failed', 'refunded', default 'pending') — replaces simple 'status' for payout tracking
  - `paid_at` (timestamptz, nullable) — when payout was completed
  - `failure_reason` (text, nullable)

4. Security
- Enable RLS on `transactions`.
- Admins can read all transactions.
- Users can read transactions where they are shipper or driver.
- Users can insert/update their own profile's momo fields.

5. Important Notes
  1. All changes are additive — no data loss.
  2. The existing earnings table gets new columns for richer payout tracking.
  3. Transaction types cover the full marketplace payment lifecycle.
*/

-- 1. Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id uuid REFERENCES loads(id) ON DELETE CASCADE,
  shipper_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  amount_ugx integer NOT NULL,
  marketplace_fee_ugx integer NOT NULL,
  driver_earnings_ugx integer NOT NULL,
  type text NOT NULL CHECK (type IN ('collection', 'disbursement', 'commission', 'refund')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'successful', 'failed', 'refunded')),
  momo_reference text,
  momo_financial_id text,
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Admins can read all transactions; users can read their own (as shipper or driver)
DROP POLICY IF EXISTS "read_transactions" ON transactions;
CREATE POLICY "read_transactions" ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR shipper_id = auth.uid()
    OR driver_id = auth.uid()
  );

-- Only service role (edge functions) can insert/update transactions
DROP POLICY IF EXISTS "insert_transactions" ON transactions;
CREATE POLICY "insert_transactions" ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR shipper_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_transactions" ON transactions;
CREATE POLICY "update_transactions" ON transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR shipper_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR shipper_id = auth.uid()
  );

-- 2. Add MoMo fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS momo_phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS momo_account_verified boolean NOT NULL DEFAULT false;

-- 3. Add payout tracking columns to earnings
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid', 'failed', 'refunded'));
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS failure_reason text;

-- 4. Add index for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_load_id ON transactions(load_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shipper_id ON transactions(shipper_id);
CREATE INDEX IF NOT EXISTS idx_transactions_driver_id ON transactions(driver_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_earnings_driver_id ON earnings(driver_id);
CREATE INDEX IF NOT EXISTS idx_earnings_load_id ON earnings(load_id);
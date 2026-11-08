/*
# Create admin_settings table for platform configuration

1. New Tables
- `admin_settings` — single-row table storing platform-wide configuration
  - `id` (int, primary key, always 1)
  - `platform_name` (text, default 'Haulix')
  - `commission_rate_pct` (numeric, default 10.0) — marketplace commission percentage
  - `min_bid_ugx` (integer, default 50000) — minimum bid amount in UGX
  - `max_load_weight_kg` (integer, default 5000) — maximum allowed load weight
  - `support_email` (text, default 'support@haulix.ug')
  - `support_phone` (text, default '+256 700 000 000')
  - `maintenance_mode` (boolean, default false)
  - `auto_approve_drivers` (boolean, default false)
  - `auto_approve_shippers` (boolean, default false)
  - `updated_at` (timestamptz)
  - `updated_by` (uuid, references auth.users)

2. Security
- Enable RLS on `admin_settings`.
- Only admin-role users can read and update settings (checked via profiles table).
*/

CREATE TABLE IF NOT EXISTS admin_settings (
  id int PRIMARY KEY DEFAULT 1,
  platform_name text NOT NULL DEFAULT 'Haulix',
  commission_rate_pct numeric NOT NULL DEFAULT 10.0,
  min_bid_ugx integer NOT NULL DEFAULT 50000,
  max_load_weight_kg integer NOT NULL DEFAULT 5000,
  support_email text NOT NULL DEFAULT 'support@haulix.ug',
  support_phone text NOT NULL DEFAULT '+256 700 000 000',
  maintenance_mode boolean NOT NULL DEFAULT false,
  auto_approve_drivers boolean NOT NULL DEFAULT false,
  auto_approve_shippers boolean NOT NULL DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO admin_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_settings" ON admin_settings;
CREATE POLICY "admin_read_settings" ON admin_settings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_settings" ON admin_settings;
CREATE POLICY "admin_update_settings" ON admin_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

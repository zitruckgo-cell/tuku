/*
# Add dispatcher role to profiles

1. Changes
- Update the `profiles.role` CHECK constraint to include 'dispatcher' alongside 'shipper', 'driver', 'admin'.
- This allows dispatcher users who manage the dispatch dashboard (monitor loads, assign drivers, track active hauls).
2. Security
- No new tables or RLS policy changes needed — existing admin_read_all_profiles and admin_update_profiles
  policies already use `role = 'admin'` checks; dispatchers will be managed by admins.
- Dispatchers can read loads/bids via existing authenticated policies.
*/

-- Drop and recreate the role check constraint to include 'dispatcher'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('shipper', 'driver', 'admin', 'dispatcher'));

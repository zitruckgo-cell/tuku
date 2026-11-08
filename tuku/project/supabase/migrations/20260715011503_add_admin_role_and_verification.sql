/*
# Add admin role and verification status to profiles

1. Modified Tables
- `profiles`
  - `verification_status` (text, default 'pending', CHECK: verification_status IN ('pending', 'approved', 'rejected', 'suspended'))
  - `admin_notes` (text, nullable) — notes added by admins during review

2. Role constraint update
  - Drop the existing `profiles_role_check` constraint
  - Re-add with 'admin' included: role IN ('shipper', 'driver', 'admin')

3. Important Notes
  1. Existing rows default to 'pending' verification automatically.
  2. Only additive changes — no data loss.
  3. Admin role is a new value in the role check constraint.
*/

-- 1. Add verification_status column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending'
  CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended'));

-- 2. Add admin_notes column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- 3. Update role constraint to include 'admin'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('shipper', 'driver', 'admin'));

-- 4. RLS: admins can read all profiles, users can read their own
--    (Existing per-user policies remain; admin gets a separate SELECT policy)
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR auth.uid() = id
  );

-- 5. Admins can update any profile's verification_status and admin_notes
DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR auth.uid() = id
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    OR auth.uid() = id
  );
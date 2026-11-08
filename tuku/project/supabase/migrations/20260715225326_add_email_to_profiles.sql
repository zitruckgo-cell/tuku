-- Add email column to profiles so admin dashboard can display and search by email
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill email from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

/*
# Add account_type and business_name to profiles

1. Modified Tables
- `profiles`
  - `account_type` (text, default 'individual', CHECK: account_type IN ('individual', 'business'))
  - `business_name` (text, nullable) — required only when account_type = 'business'

2. Important Notes
  1. Existing rows default to 'individual' automatically.
  2. No data loss — only additive columns.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'individual' CHECK (account_type IN ('individual', 'business'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS business_name text;
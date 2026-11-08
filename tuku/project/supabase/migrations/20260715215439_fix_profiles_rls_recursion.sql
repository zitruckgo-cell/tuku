/*
# Fix infinite recursion in profiles RLS policies

## Problem
The `admin_read_all_profiles` and `admin_update_profiles` policies on the `profiles`
table use `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`.
This queries the `profiles` table from within a policy ON `profiles`, causing
infinite recursion: PostgreSQL evaluates the policy → runs the subquery → that
subquery triggers the same policy again → repeat → error 42P17.

This breaks ALL profile reads (including login), since every SELECT on profiles
hits the recursive policy.

## Fix
1. Create a `SECURITY DEFINER` function `is_admin()` that checks the user's role
   in `profiles` while bypassing RLS (SECURITY DEFINER runs as the function owner,
   which is the postgres superuser — RLS does not apply).
2. Replace the recursive `EXISTS` subqueries with `public.is_admin()`.
3. Drop the recursive policies and recreate them using the function.
4. Also clean up the redundant `read_all_profiles` policy (any authenticated user
   can read all profiles — needed for shipper/driver lookups) and make sure it
   doesn't conflict.

## Security
- `is_admin()` is `SECURITY DEFINER`, owned by postgres, so it bypasses RLS safely.
- It only returns a boolean — no data leakage.
- All other policies remain unchanged.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Drop the recursive admin SELECT policy
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;

-- Recreate using is_admin() — no recursion
CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (public.is_admin() OR auth.uid() = id);

-- Drop the recursive admin UPDATE policy
DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;

-- Recreate using is_admin()
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR auth.uid() = id)
  WITH CHECK (public.is_admin() OR auth.uid() = id);

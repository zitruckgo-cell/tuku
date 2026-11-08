-- Allow admins to insert profiles directly (for manually adding users)
CREATE POLICY "admin_insert_profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

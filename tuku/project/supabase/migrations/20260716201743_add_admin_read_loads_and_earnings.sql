-- Allow admins to read all loads (currently blocked: only shipper/awarded_rider/posted)
CREATE POLICY "admin_read_all_loads"
  ON loads FOR SELECT
  TO authenticated
  USING (is_admin());

-- Allow admins to update all loads (currently blocked: only shipper/awarded_rider)
CREATE POLICY "admin_update_all_loads"
  ON loads FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Allow admins to read all earnings (currently blocked: only driver/shipper)
CREATE POLICY "admin_read_all_earnings"
  ON earnings FOR SELECT
  TO authenticated
  USING (is_admin());

-- Allow admins to delete loads
CREATE POLICY "admin_delete_loads"
  ON loads FOR DELETE
  TO authenticated
  USING (is_admin());

-- Allow admins to insert loads
CREATE POLICY "admin_insert_loads"
  ON loads FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

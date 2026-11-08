-- Allow admins to read all bids (currently blocked: only rider or load shipper)
CREATE POLICY "admin_read_all_bids"
  ON bids FOR SELECT
  TO authenticated
  USING (is_admin());

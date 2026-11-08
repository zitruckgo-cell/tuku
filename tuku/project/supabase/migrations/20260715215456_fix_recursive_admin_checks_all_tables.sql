/*
# Fix recursive admin checks in support_tickets, support_messages, and transactions

## Problem
Multiple tables have policies that use `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`.
When these policies are evaluated, the subquery on `profiles` triggers profiles' own RLS policies,
which in turn may trigger recursion. With the profiles admin policies now using `is_admin()` (a
SECURITY DEFINER function that bypasses RLS), the profiles recursion is fixed — but the subqueries
in these other tables still go through the normal RLS evaluation path on profiles, which can cause
performance issues or secondary recursion if profiles policies change.

## Fix
Replace all `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')` patterns
with `public.is_admin()` across support_tickets, support_messages, and transactions policies.

## Security
- `is_admin()` is SECURITY DEFINER, bypasses RLS safely, returns only a boolean.
- No data leakage.
- All non-admin ownership checks remain unchanged.
*/

-- ── support_tickets ──
DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "admin_update_tickets" ON support_tickets;
CREATE POLICY "admin_update_tickets" ON support_tickets FOR UPDATE
  TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── support_messages ──
DROP POLICY IF EXISTS "select_ticket_messages" ON support_messages;
CREATE POLICY "select_ticket_messages" ON support_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "admin_insert_ticket_messages" ON support_messages;
CREATE POLICY "admin_insert_ticket_messages" ON support_messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'admin'
    AND public.is_admin()
  );

-- ── transactions ──
DROP POLICY IF EXISTS "read_transactions" ON transactions;
CREATE POLICY "read_transactions" ON transactions FOR SELECT
  TO authenticated USING (
    public.is_admin() OR shipper_id = auth.uid() OR driver_id = auth.uid()
  );

DROP POLICY IF EXISTS "insert_transactions" ON transactions;
CREATE POLICY "insert_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (
    public.is_admin() OR shipper_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_transactions" ON transactions;
CREATE POLICY "update_transactions" ON transactions FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR shipper_id = auth.uid())
  WITH CHECK (public.is_admin() OR shipper_id = auth.uid());

/*
# Create support tickets and messages tables

## Purpose
Customer support system. Users (shippers/drivers) can create support tickets
and exchange messages with admin support staff. Admins manage tickets from
the admin dashboard.

## New Tables

### support_tickets
- `id` (uuid, PK)
- `user_id` (uuid, FK → auth.users, defaults to auth.uid()) — ticket owner
- `subject` (text, not null) — short title
- `category` (text, not null) — 'payment' | 'delivery' | 'account' | 'technical' | 'other'
- `priority` (text, default 'normal') — 'low' | 'normal' | 'high' | 'urgent'
- `status` (text, default 'open') — 'open' | 'pending' | 'resolved' | 'closed'
- `load_id` (uuid, nullable, FK → loads) — optional related load
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())
- `last_message_at` (timestamptz, default now()) — for sorting by latest activity

### support_messages
- `id` (uuid, PK)
- `ticket_id` (uuid, FK → support_tickets ON DELETE CASCADE)
- `sender_id` (uuid, FK → auth.users, defaults to auth.uid())
- `sender_role` (text, not null) — 'user' | 'admin'
- `body` (text, not null)
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on both tables.
- support_tickets: users can CRUD their own tickets; admins can read/update all.
- support_messages: users can SELECT/INSERT messages on their own tickets; admins can SELECT/INSERT all.
- Admin check uses EXISTS subquery on profiles where role = 'admin'.

## Indexes
- support_tickets(user_id) — user's ticket list
- support_tickets(status) — admin filtering
- support_messages(ticket_id) — message thread lookup
*/

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  load_id uuid REFERENCES loads(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users: own ticket CRUD
DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_tickets" ON support_tickets;
CREATE POLICY "update_own_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_tickets" ON support_tickets;
CREATE POLICY "delete_own_tickets" ON support_tickets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Admins can update any ticket (for status changes)
DROP POLICY IF EXISTS "admin_update_tickets" ON support_tickets;
CREATE POLICY "admin_update_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages on their own tickets; admins can read all
DROP POLICY IF EXISTS "select_ticket_messages" ON support_messages;
CREATE POLICY "select_ticket_messages" ON support_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Users can insert messages on their own tickets
DROP POLICY IF EXISTS "insert_own_ticket_messages" ON support_messages;
CREATE POLICY "insert_own_ticket_messages" ON support_messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'user'
    AND EXISTS (SELECT 1 FROM support_tickets t WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid())
  );

-- Admins can insert messages on any ticket
DROP POLICY IF EXISTS "admin_insert_ticket_messages" ON support_messages;
CREATE POLICY "admin_insert_ticket_messages" ON support_messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND sender_role = 'admin'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at);

-- Auto-update updated_at on ticket changes
CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_ticket_updated ON support_tickets;
CREATE TRIGGER trg_support_ticket_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_timestamp();

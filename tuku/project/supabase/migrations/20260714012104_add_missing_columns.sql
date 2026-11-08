
/*
# Add Missing Columns for Tuku ZitruckGo

Adds columns needed by the dispatch marketplace frontend:
- loads.title: human-readable load title
- profiles.is_available: rider availability flag
- rider_locations.load_id: links GPS ping to active load
- proof_of_delivery.rider_id: tracks which rider submitted POD
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='loads' AND column_name='title') THEN
    ALTER TABLE loads ADD COLUMN title text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_available') THEN
    ALTER TABLE profiles ADD COLUMN is_available boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rider_locations' AND column_name='load_id') THEN
    ALTER TABLE rider_locations ADD COLUMN load_id uuid REFERENCES loads(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='proof_of_delivery' AND column_name='rider_id') THEN
    ALTER TABLE proof_of_delivery ADD COLUMN rider_id uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Ensure RLS policies exist on status_updates
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "su_sel" ON status_updates;
CREATE POLICY "su_sel" ON status_updates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "su_ins" ON status_updates;
CREATE POLICY "su_ins" ON status_updates FOR INSERT TO authenticated WITH CHECK (true);

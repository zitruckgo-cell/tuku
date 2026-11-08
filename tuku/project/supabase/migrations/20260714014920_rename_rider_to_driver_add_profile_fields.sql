
/*
# Rename Rider → Driver & Add Driver Profile Fields

Drops the old role check constraint first, migrates data, then re-adds with 'driver'.
Adds Ugandan address, document reference, and special_instructions fields.
*/

-- 1. Drop old constraint first
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Update existing 'rider' values to 'driver'
UPDATE profiles SET role = 'driver' WHERE role = 'rider';

-- 3. Re-add constraint with 'driver'
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('shipper', 'driver'));

-- 4. Ugandan address fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_village') THEN
    ALTER TABLE profiles ADD COLUMN address_village text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_parish') THEN
    ALTER TABLE profiles ADD COLUMN address_parish text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_subcounty') THEN
    ALTER TABLE profiles ADD COLUMN address_subcounty text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address_district') THEN
    ALTER TABLE profiles ADD COLUMN address_district text;
  END IF;
END $$;

-- 5. Document reference fields
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='national_id_number') THEN
    ALTER TABLE profiles ADD COLUMN national_id_number text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='lc_letter_ref') THEN
    ALTER TABLE profiles ADD COLUMN lc_letter_ref text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='referral_letter_ref') THEN
    ALTER TABLE profiles ADD COLUMN referral_letter_ref text;
  END IF;
END $$;

-- 6. Special instructions / short messages
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='special_instructions') THEN
    ALTER TABLE profiles ADD COLUMN special_instructions text;
  END IF;
END $$;

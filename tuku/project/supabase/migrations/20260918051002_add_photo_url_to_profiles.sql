/*
# Add photo_url column to profiles

1. Changes
- Adds `photo_url` (text) column to the `profiles` table.
- This column stores the public URL of a driver's uploaded profile photo.
2. Security
- No new RLS policies needed — existing profiles policies already allow users to update their own row.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_url text;

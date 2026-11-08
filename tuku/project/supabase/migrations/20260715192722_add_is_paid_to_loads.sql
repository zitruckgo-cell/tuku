/*
# Add is_paid column to loads table

## Purpose
Enforces the "pay at booking" workflow. Loads are created with `is_paid = false`.
The edge function sets `is_paid = true` once MoMo collection succeeds.
Drivers can only see and bid on loads that are paid.

## Changes
1. New column: `loads.is_paid` (boolean, default false)
2. Index on `is_paid` for efficient filtering by drivers

## Security
No RLS changes — existing policies still apply.
*/

ALTER TABLE loads ADD COLUMN IF NOT EXISTS is_paid boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_loads_is_paid ON loads(is_paid) WHERE is_paid = true;

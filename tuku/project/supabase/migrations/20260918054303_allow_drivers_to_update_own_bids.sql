/*
# Allow drivers to update their own bids

## Problem
The existing `update_bids` RLS policy only allowed the **shipper** (who owns the
load) to update bids — e.g. to accept or reject them. Drivers had no way to
modify a bid they already placed, which blocked counter-offers.

## Fix
Add a new `update_own_bids` policy that lets a driver update their own bid rows
(scoped by `auth.uid() = rider_id`). The existing shipper-scoped `update_bids`
policy is kept so shippers can still accept/reject bids.

## Security
- New policy: `update_own_bids` — `FOR UPDATE TO authenticated USING (auth.uid() = rider_id) WITH CHECK (auth.uid() = rider_id)`.
- Existing `update_bids` policy (shipper-scoped) is untouched.
- Both policies are permissive (OR'd together), so either the bid owner or the
  load's shipper can update a bid row.
*/

DROP POLICY IF EXISTS "update_own_bids" ON bids;
CREATE POLICY "update_own_bids" ON bids FOR UPDATE
  TO authenticated
  USING (auth.uid() = rider_id)
  WITH CHECK (auth.uid() = rider_id);

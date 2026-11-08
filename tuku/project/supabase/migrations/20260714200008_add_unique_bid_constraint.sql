-- Prevent a driver from placing more than one bid per load
CREATE UNIQUE INDEX IF NOT EXISTS bids_load_rider_uniq ON public.bids (load_id, rider_id);
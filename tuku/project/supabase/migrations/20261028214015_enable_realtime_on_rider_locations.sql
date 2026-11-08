-- Enable realtime broadcasts on rider_locations so the admin Live Tracking
-- view updates automatically when drivers' GPS pings arrive.
ALTER PUBLICATION supabase_realtime ADD TABLE rider_locations;

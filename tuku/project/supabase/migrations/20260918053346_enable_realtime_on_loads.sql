/*
# Enable realtime on loads table

## Problem
The loads table was not in the supabase_realtime publication, so drivers
never received push notifications when shippers posted new loads. The driver
portal only fetched loads once on page mount, so newly posted loads were
invisible until a manual refresh.

## Fix
Add the loads table to the supabase_realtime publication so INSERT/UPDATE/
DELETE events are streamed to subscribed clients.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE loads;

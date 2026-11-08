/*
# Add stop_type and ticket_label to load_stops

## Purpose
Supports return stops — stops the driver makes AFTER delivery on the way back
(e.g. picking up a document, receipt, or item to bring back). Previously all
stops were "intermediate" (between pickup and delivery).

## Changes to load_stops table
1. Add `stop_type` (text, NOT NULL, default 'intermediate')
   - 'intermediate': a stop on the way to delivery (existing behavior)
   - 'return': a stop on the way back after delivery
2. Add `ticket_label` (text, nullable)
   - For return stops: describes what ticket/document/item to collect
     (e.g. "Signed delivery receipt", "Return lab sample container")

## Security
No policy changes — existing RLS on load_stops already covers all columns.
*/

ALTER TABLE load_stops ADD COLUMN IF NOT EXISTS stop_type text NOT NULL DEFAULT 'intermediate';
ALTER TABLE load_stops ADD COLUMN IF NOT EXISTS ticket_label text;

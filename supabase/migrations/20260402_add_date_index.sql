-- Add index on global_events.date to speed up date-range queries (discover pagination)
CREATE INDEX IF NOT EXISTS idx_global_events_date ON global_events (date);

-- Add composite index for common filtered queries
CREATE INDEX IF NOT EXISTS idx_global_events_date_event_type ON global_events (date, event_type);

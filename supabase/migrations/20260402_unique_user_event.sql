-- Prevent users from registering the same global event more than once.
-- Custom events (global_event_id IS NULL) are not affected by this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_global_event
  ON user_events (user_id, global_event_id)
  WHERE global_event_id IS NOT NULL;

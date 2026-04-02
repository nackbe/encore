-- Audit logging table for tracking user actions
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,           -- e.g. 'event.create', 'event.delete', 'wishlist.add'
  entity_type TEXT,               -- e.g. 'user_event', 'user_wishlist'
  entity_id TEXT,                 -- ID of the affected entity
  metadata JSONB DEFAULT '{}',    -- Additional context (e.g. event name, old values)
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by user
CREATE INDEX idx_audit_log_user_id ON audit_log (user_id);

-- Index for querying by action type
CREATE INDEX idx_audit_log_action ON audit_log (action);

-- Index for time-based queries
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);

-- RLS: users can only read their own audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit log"
  ON audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (from server-side API routes)
CREATE POLICY "Service role can insert audit log"
  ON audit_log FOR INSERT
  WITH CHECK (true);

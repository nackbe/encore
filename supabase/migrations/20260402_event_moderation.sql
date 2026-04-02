-- Add moderation status to global_events for user-submitted events
ALTER TABLE global_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Only show approved events in public queries
-- (existing RLS policies should be updated to filter by status = 'approved')
CREATE INDEX idx_global_events_status ON global_events (status);

-- Users can view pending events they submitted
CREATE POLICY "Users can view own pending events"
  ON global_events FOR SELECT
  USING (status = 'approved' OR submitted_by = auth.uid());

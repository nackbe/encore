-- 00002_rls_policies.sql
-- Encore: Row Level Security policies

------------------------------------------------------------------------
-- Enable RLS on all tables
------------------------------------------------------------------------

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists               ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues                ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_event_artists  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_event_artists    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_followed_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache             ENABLE ROW LEVEL SECURITY;
ALTER TABLE historic_badges       ENABLE ROW LEVEL SECURITY;

------------------------------------------------------------------------
-- profiles: users can read and update their own profile only
------------------------------------------------------------------------

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

------------------------------------------------------------------------
-- user_events: users can CRUD their own events
------------------------------------------------------------------------

CREATE POLICY "user_events_select_own"
  ON user_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_events_insert_own"
  ON user_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_events_update_own"
  ON user_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_events_delete_own"
  ON user_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

------------------------------------------------------------------------
-- user_event_artists: users can CRUD their own records
------------------------------------------------------------------------

CREATE POLICY "user_event_artists_select_own"
  ON user_event_artists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_event_artists_insert_own"
  ON user_event_artists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_event_artists_update_own"
  ON user_event_artists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_event_artists_delete_own"
  ON user_event_artists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

------------------------------------------------------------------------
-- user_followed_artists: users can CRUD their own follows
------------------------------------------------------------------------

CREATE POLICY "user_followed_artists_select_own"
  ON user_followed_artists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_followed_artists_insert_own"
  ON user_followed_artists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_followed_artists_update_own"
  ON user_followed_artists FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_followed_artists_delete_own"
  ON user_followed_artists FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

------------------------------------------------------------------------
-- artists: anyone can SELECT, only service_role can INSERT/UPDATE
------------------------------------------------------------------------

CREATE POLICY "artists_select_all"
  ON artists FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "artists_insert_service"
  ON artists FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "artists_update_service"
  ON artists FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

------------------------------------------------------------------------
-- global_events: anyone can SELECT, service_role can INSERT/UPDATE,
-- authenticated users can INSERT with source='user_submitted'
------------------------------------------------------------------------

CREATE POLICY "global_events_select_all"
  ON global_events FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "global_events_insert_service"
  ON global_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "global_events_update_service"
  ON global_events FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "global_events_insert_user_submitted"
  ON global_events FOR INSERT
  TO authenticated
  WITH CHECK (source = 'user_submitted');

-- global_event_artists: readable by anyone, writable by service_role
CREATE POLICY "global_event_artists_select_all"
  ON global_event_artists FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "global_event_artists_insert_service"
  ON global_event_artists FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "global_event_artists_update_service"
  ON global_event_artists FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

------------------------------------------------------------------------
-- venues: anyone can SELECT, service_role can INSERT/UPDATE
------------------------------------------------------------------------

CREATE POLICY "venues_select_all"
  ON venues FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "venues_insert_service"
  ON venues FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "venues_update_service"
  ON venues FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

------------------------------------------------------------------------
-- api_cache: no client access, only service_role
------------------------------------------------------------------------

CREATE POLICY "api_cache_service_all"
  ON api_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

------------------------------------------------------------------------
-- historic_badges: anyone can SELECT
------------------------------------------------------------------------

CREATE POLICY "historic_badges_select_all"
  ON historic_badges FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "historic_badges_insert_service"
  ON historic_badges FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "historic_badges_update_service"
  ON historic_badges FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

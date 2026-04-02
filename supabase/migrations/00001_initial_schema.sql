-- 00001_initial_schema.sql
-- Encore: Initial database schema

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

------------------------------------------------------------------------
-- Helper functions
------------------------------------------------------------------------

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile row when a new auth.users row is inserted
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email),
    now(),
    now()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------

-- 1. profiles
CREATE TABLE profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name        text,
  avatar_url          text,
  city                text,
  country             text,
  preferred_genres    text[],
  preferred_locale    text DEFAULT 'es',
  spotify_connected   boolean DEFAULT false,
  onboarding_complete boolean DEFAULT false,
  subscription_tier   text DEFAULT 'free',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- 2. artists
CREATE TABLE artists (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     text NOT NULL,
  name_normalized          text NOT NULL,
  spotify_id               text UNIQUE,
  musicbrainz_id           text,
  image_url                text,
  genres                   text[],
  country                  text,
  spotify_popularity       int,
  spotify_monthly_listeners int,
  spotify_followers        int,
  is_active                boolean DEFAULT true,
  last_synced_at           timestamptz,
  created_at               timestamptz DEFAULT now()
);

-- 3. venues
CREATE TABLE venues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  name_normalized text NOT NULL,
  city            text,
  country         text,
  lat             numeric,
  lng             numeric,
  capacity        int,
  venue_type      text,
  image_url       text,
  website         text,
  is_verified     boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- 4. global_events
CREATE TABLE global_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  event_type          text NOT NULL,
  date                date NOT NULL,
  date_end            date,
  venue_id            uuid REFERENCES venues ON DELETE SET NULL,
  city                text,
  country             text,
  lat                 numeric,
  lng                 numeric,
  poster_url          text,
  ticket_url          text,
  ticket_price_min    numeric,
  ticket_price_max    numeric,
  currency            text,
  source              text NOT NULL,
  source_id           text,
  source_url          text,
  confidence_score    float DEFAULT 1.0,
  is_past             boolean DEFAULT false,
  historic_badge_type  text,
  historic_badge_title text,
  historic_badge_desc  text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  CONSTRAINT global_events_source_source_id_key UNIQUE (source, source_id)
);

-- 5. global_event_artists
CREATE TABLE global_event_artists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  global_event_id uuid NOT NULL REFERENCES global_events ON DELETE CASCADE,
  artist_id       uuid NOT NULL REFERENCES artists ON DELETE CASCADE,
  role            text DEFAULT 'performer',
  stage           text,
  billing_order   int
);

-- 6. user_events
CREATE TABLE user_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  global_event_id   uuid REFERENCES global_events ON DELETE SET NULL,
  custom_event_name text,
  custom_event_date date,
  custom_event_city text,
  event_type        text NOT NULL,
  rating            int CHECK (rating >= 1 AND rating <= 5),
  mood              text,
  is_memorable      boolean DEFAULT false,
  memorable_reason  text,
  notes             text,
  ticket_price      numeric,
  currency          text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- 7. user_event_artists
CREATE TABLE user_event_artists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_event_id   uuid NOT NULL REFERENCES user_events ON DELETE CASCADE,
  artist_id       uuid NOT NULL REFERENCES artists ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  personal_rating int CHECK (personal_rating >= 1 AND personal_rating <= 5),
  highlight_song  text,
  notes           text
);

-- 8. user_followed_artists
CREATE TABLE user_followed_artists (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  artist_id         uuid NOT NULL REFERENCES artists ON DELETE CASCADE,
  followed_at       timestamptz DEFAULT now(),
  notify_new_events boolean DEFAULT true,

  CONSTRAINT user_followed_artists_user_artist_key UNIQUE (user_id, artist_id)
);

-- 9. api_cache
CREATE TABLE api_cache (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key     text UNIQUE NOT NULL,
  response_data jsonb NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- 10. historic_badges
CREATE TABLE historic_badges (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_name text,
  artist_id   uuid REFERENCES artists ON DELETE SET NULL,
  badge_type  text NOT NULL,
  title       text NOT NULL,
  description text,
  event_date  date,
  event_city  text,
  sources     text[],
  verified    boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

------------------------------------------------------------------------
-- Indexes
------------------------------------------------------------------------

-- artists: trigram search on normalized name
CREATE INDEX idx_artists_name_normalized_trgm
  ON artists USING gin (name_normalized gin_trgm_ops);

-- artists: genres GIN
CREATE INDEX idx_artists_genres
  ON artists USING gin (genres);

-- global_events: city + date for location-based lookups
CREATE INDEX idx_global_events_city_date
  ON global_events (city, date);

-- global_events: country + date
CREATE INDEX idx_global_events_country_date
  ON global_events (country, date);

-- (source, source_id) is already covered by the UNIQUE constraint

-- user_event_artists: composite for user+artist queries
CREATE INDEX idx_user_event_artists_user_artist
  ON user_event_artists (user_id, artist_id);

------------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------------

-- updated_at triggers
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_global_events_updated_at
  BEFORE UPDATE ON global_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_user_events_updated_at
  BEFORE UPDATE ON user_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

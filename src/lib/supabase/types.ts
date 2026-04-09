export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          city: string | null;
          country: string | null;
          preferred_genres: string[];
          preferred_locale: string;
          spotify_connected: boolean;
          onboarding_complete: boolean;
          subscription_tier: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          city?: string | null;
          country?: string | null;
          preferred_genres?: string[];
          preferred_locale?: string;
          spotify_connected?: boolean;
          onboarding_complete?: boolean;
          subscription_tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          city?: string | null;
          country?: string | null;
          preferred_genres?: string[];
          preferred_locale?: string;
          spotify_connected?: boolean;
          onboarding_complete?: boolean;
          subscription_tier?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      artists: {
        Row: {
          id: string;
          name: string;
          name_normalized: string;
          spotify_id: string | null;
          musicbrainz_id: string | null;
          image_url: string | null;
          genres: string[];
          country: string | null;
          spotify_popularity: number | null;
          spotify_monthly_listeners: number | null;
          spotify_followers: number | null;
          is_active: boolean;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_normalized: string;
          spotify_id?: string | null;
          musicbrainz_id?: string | null;
          image_url?: string | null;
          genres?: string[];
          country?: string | null;
          spotify_popularity?: number | null;
          spotify_monthly_listeners?: number | null;
          spotify_followers?: number | null;
          is_active?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          name_normalized?: string;
          spotify_id?: string | null;
          musicbrainz_id?: string | null;
          image_url?: string | null;
          genres?: string[];
          country?: string | null;
          spotify_popularity?: number | null;
          spotify_monthly_listeners?: number | null;
          spotify_followers?: number | null;
          is_active?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      venues: {
        Row: {
          id: string;
          name: string;
          name_normalized: string;
          city: string | null;
          country: string | null;
          lat: number | null;
          lng: number | null;
          capacity: number | null;
          venue_type: string | null;
          image_url: string | null;
          website: string | null;
          is_verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_normalized: string;
          city?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          capacity?: number | null;
          venue_type?: string | null;
          image_url?: string | null;
          website?: string | null;
          is_verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          name_normalized?: string;
          city?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          capacity?: number | null;
          venue_type?: string | null;
          image_url?: string | null;
          website?: string | null;
          is_verified?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      global_events: {
        Row: {
          id: string;
          name: string;
          event_type: string;
          date: string;
          date_end: string | null;
          venue_id: string | null;
          city: string | null;
          country: string | null;
          lat: number | null;
          lng: number | null;
          poster_url: string | null;
          lineup_image_url: string | null;
          ticket_url: string | null;
          ticket_price_min: number | null;
          ticket_price_max: number | null;
          currency: string | null;
          source: string;
          source_id: string | null;
          source_url: string | null;
          confidence_score: number;
          is_past: boolean;
          historic_badge_type: string | null;
          historic_badge_title: string | null;
          historic_badge_desc: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          event_type: string;
          date: string;
          date_end?: string | null;
          venue_id?: string | null;
          city?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          poster_url?: string | null;
          lineup_image_url?: string | null;
          ticket_url?: string | null;
          ticket_price_min?: number | null;
          ticket_price_max?: number | null;
          currency?: string | null;
          source: string;
          source_id?: string | null;
          source_url?: string | null;
          confidence_score?: number;
          is_past?: boolean;
          historic_badge_type?: string | null;
          historic_badge_title?: string | null;
          historic_badge_desc?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          event_type?: string;
          date?: string;
          date_end?: string | null;
          venue_id?: string | null;
          city?: string | null;
          country?: string | null;
          lat?: number | null;
          lng?: number | null;
          poster_url?: string | null;
          lineup_image_url?: string | null;
          ticket_url?: string | null;
          ticket_price_min?: number | null;
          ticket_price_max?: number | null;
          currency?: string | null;
          source?: string;
          source_id?: string | null;
          source_url?: string | null;
          confidence_score?: number;
          is_past?: boolean;
          historic_badge_type?: string | null;
          historic_badge_title?: string | null;
          historic_badge_desc?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      global_event_artists: {
        Row: {
          id: string;
          global_event_id: string;
          artist_id: string;
          role: string;
          stage: string | null;
          billing_order: number | null;
        };
        Insert: {
          id?: string;
          global_event_id: string;
          artist_id: string;
          role?: string;
          stage?: string | null;
          billing_order?: number | null;
        };
        Update: {
          id?: string;
          global_event_id?: string;
          artist_id?: string;
          role?: string;
          stage?: string | null;
          billing_order?: number | null;
        };
        Relationships: [];
      };
      user_events: {
        Row: {
          id: string;
          user_id: string;
          global_event_id: string | null;
          custom_event_name: string | null;
          custom_event_date: string | null;
          custom_event_city: string | null;
          event_type: string;
          rating: number | null;
          mood: string | null;
          is_memorable: boolean;
          memorable_reason: string | null;
          notes: string | null;
          ticket_price: number | null;
          currency: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          global_event_id?: string | null;
          custom_event_name?: string | null;
          custom_event_date?: string | null;
          custom_event_city?: string | null;
          event_type: string;
          rating?: number | null;
          mood?: string | null;
          is_memorable?: boolean;
          memorable_reason?: string | null;
          notes?: string | null;
          ticket_price?: number | null;
          currency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          global_event_id?: string | null;
          custom_event_name?: string | null;
          custom_event_date?: string | null;
          custom_event_city?: string | null;
          event_type?: string;
          rating?: number | null;
          mood?: string | null;
          is_memorable?: boolean;
          memorable_reason?: string | null;
          notes?: string | null;
          ticket_price?: number | null;
          currency?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_event_artists: {
        Row: {
          id: string;
          user_event_id: string;
          artist_id: string;
          user_id: string;
          personal_rating: number | null;
          highlight_song: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_event_id: string;
          artist_id: string;
          user_id: string;
          personal_rating?: number | null;
          highlight_song?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          user_event_id?: string;
          artist_id?: string;
          user_id?: string;
          personal_rating?: number | null;
          highlight_song?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      user_followed_artists: {
        Row: {
          id: string;
          user_id: string;
          artist_id: string;
          followed_at: string;
          notify_new_events: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          artist_id: string;
          followed_at?: string;
          notify_new_events?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          artist_id?: string;
          followed_at?: string;
          notify_new_events?: boolean;
        };
        Relationships: [];
      };
      api_cache: {
        Row: {
          id: string;
          cache_key: string;
          response_data: Record<string, unknown>;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          cache_key: string;
          response_data: Record<string, unknown>;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          cache_key?: string;
          response_data?: Record<string, unknown>;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      historic_badges: {
        Row: {
          id: string;
          artist_name: string | null;
          artist_id: string | null;
          badge_type: string;
          title: string;
          description: string | null;
          event_date: string | null;
          event_city: string | null;
          sources: string[];
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          artist_name?: string | null;
          artist_id?: string | null;
          badge_type: string;
          title: string;
          description?: string | null;
          event_date?: string | null;
          event_city?: string | null;
          sources?: string[];
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          artist_name?: string | null;
          artist_id?: string | null;
          badge_type?: string;
          title?: string;
          description?: string | null;
          event_date?: string | null;
          event_city?: string | null;
          sources?: string[];
          verified?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      user_wishlist: {
        Row: {
          id: string;
          user_id: string;
          global_event_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          global_event_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          global_event_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Artist = Database['public']['Tables']['artists']['Row'];
export type ArtistInsert = Database['public']['Tables']['artists']['Insert'];
export type ArtistUpdate = Database['public']['Tables']['artists']['Update'];

export type Venue = Database['public']['Tables']['venues']['Row'];
export type VenueInsert = Database['public']['Tables']['venues']['Insert'];
export type VenueUpdate = Database['public']['Tables']['venues']['Update'];

export type GlobalEvent = Database['public']['Tables']['global_events']['Row'];
export type GlobalEventInsert = Database['public']['Tables']['global_events']['Insert'];
export type GlobalEventUpdate = Database['public']['Tables']['global_events']['Update'];

export type GlobalEventArtist = Database['public']['Tables']['global_event_artists']['Row'];
export type GlobalEventArtistInsert = Database['public']['Tables']['global_event_artists']['Insert'];
export type GlobalEventArtistUpdate = Database['public']['Tables']['global_event_artists']['Update'];

export type UserEvent = Database['public']['Tables']['user_events']['Row'];
export type UserEventInsert = Database['public']['Tables']['user_events']['Insert'];
export type UserEventUpdate = Database['public']['Tables']['user_events']['Update'];

export type UserEventArtist = Database['public']['Tables']['user_event_artists']['Row'];
export type UserEventArtistInsert = Database['public']['Tables']['user_event_artists']['Insert'];
export type UserEventArtistUpdate = Database['public']['Tables']['user_event_artists']['Update'];

export type UserFollowedArtist = Database['public']['Tables']['user_followed_artists']['Row'];
export type UserFollowedArtistInsert = Database['public']['Tables']['user_followed_artists']['Insert'];
export type UserFollowedArtistUpdate = Database['public']['Tables']['user_followed_artists']['Update'];

export type ApiCache = Database['public']['Tables']['api_cache']['Row'];
export type ApiCacheInsert = Database['public']['Tables']['api_cache']['Insert'];
export type ApiCacheUpdate = Database['public']['Tables']['api_cache']['Update'];

export type HistoricBadge = Database['public']['Tables']['historic_badges']['Row'];
export type HistoricBadgeInsert = Database['public']['Tables']['historic_badges']['Insert'];
export type HistoricBadgeUpdate = Database['public']['Tables']['historic_badges']['Update'];

export type UserWishlist = Database['public']['Tables']['user_wishlist']['Row'];
export type UserWishlistInsert = Database['public']['Tables']['user_wishlist']['Insert'];
export type UserWishlistUpdate = Database['public']['Tables']['user_wishlist']['Update'];

'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/lib/supabase/types';

interface UserContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchProfile = useCallback(
    async (userId: string) => {
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (!mountedRef.current) return;

        if (profileError && profileError.code === 'PGRST116') {
          // Profile doesn't exist (e.g. new Google OAuth user) — create it
          const { data: { user: authUser } } = await supabase.auth.getUser();
          const displayName = authUser?.user_metadata?.full_name
            ?? authUser?.user_metadata?.name
            ?? authUser?.email?.split('@')[0]
            ?? 'User';

          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert({ id: userId, display_name: displayName }, { onConflict: 'id' })
            .select('*')
            .single();

          if (!mountedRef.current) return;
          if (insertError) {
            console.warn('[UserProvider] Profile create error:', insertError.message);
            setProfile(null);
          } else {
            setProfile(newProfile);
            setError(null);
          }
        } else if (profileError) {
          console.warn('[UserProvider] Profile fetch error:', profileError.message);
          setProfile(null);
        } else {
          setProfile(data);
          setError(null);
        }
      } catch (err) {
        if (!mountedRef.current) return;
        console.warn('[UserProvider] Profile fetch failed:', err);
        setProfile(null);
      }
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    mountedRef.current = true;

    // onAuthStateChange fires INITIAL_SESSION immediately, then SIGNED_IN/TOKEN_REFRESHED as needed.
    // This is the single source of truth for auth state.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Don't await — let profile load in background so isLoading clears fast
        fetchProfile(newSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setError(null);
      }

      setIsLoading(false);
    });

    // Safety: if onAuthStateChange never fires (shouldn't happen), stop loading after 5s
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return (
    <UserContext.Provider
      value={{ user, session, profile, isLoading, error, refreshProfile }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}

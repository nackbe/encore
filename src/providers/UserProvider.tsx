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

        if (profileError) {
          // Profile might not exist yet (new user) — not a fatal error
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

    // 1. Set up auth state listener FIRST — catches events during init
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        await fetchProfile(newSession.user.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setError(null);
      }

      // Always mark loading as done once we get any auth event
      if (isLoading) {
        setIsLoading(false);
      }
    });

    // 2. Then get current session — triggers INITIAL_SESSION event above
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mountedRef.current) return;

      // If onAuthStateChange hasn't fired yet, set state directly
      if (isLoading) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        if (currentSession?.user) {
          fetchProfile(currentSession.user.id).finally(() => {
            if (mountedRef.current) setIsLoading(false);
          });
        } else {
          setIsLoading(false);
        }
      }
    }).catch(() => {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    });

    // Safety: if nothing fires in 5s, stop loading
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current && isLoading) {
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

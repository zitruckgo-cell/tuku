import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../lib/types';
import { sendWelcomeEmail } from '../lib/email';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; profile: Profile | null }>;
  signUp: (email: string, password: string, profileData: Partial<Profile> & { full_name: string; phone: string; role: UserRole }) => Promise<{ error: string | null; profile: Profile | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const profileUidRef = useRef<string | null>(null);
  const loadingUidRef = useRef<string | null>(null);
  const signingInRef = useRef(false);

  const loadProfile = useCallback(async (uid: string) => {
    if (loadingUidRef.current === uid) return;
    loadingUidRef.current = uid;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    if (error) console.error('Failed to load profile:', error.message);
    profileUidRef.current = uid;
    setProfile(data ?? null);
    setLoading(false);
    loadingUidRef.current = null;
    return data;
  }, []);

  // Initial session load
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (!session?.user) {
        setLoading(false);
        return;
      }
      setUser(session.user);
    }).catch((err) => {
      console.error('Session restore failed:', err);
      if (mounted) setLoading(false);
    });

    // Only update React state when the actual user ID changes.
    // Supabase fires onAuthStateChange frequently (token refreshes, internal
    // events every ~10s). Propagating those to state creates new object refs
    // that cascade re-renders through every consumer and flash the dashboards.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUid = session?.user?.id ?? null;
      const currentUid = profileUidRef.current;
      if (newUid === currentUid) return;

      if (!newUid) {
        if (!signingInRef.current) {
          setUser(null);
          setProfile(null);
          profileUidRef.current = null;
          setLoading(false);
        }
      } else {
        setUser(session!.user);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load profile whenever user changes (runs AFTER render, avoiding deadlock).
  useEffect(() => {
    if (user) {
      if (signingInRef.current) return;
      if (profileUidRef.current === user.id) return;
      loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setProfile(null);
    profileUidRef.current = null;
    signingInRef.current = true;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { signingInRef.current = false; setLoading(false); return { error: error.message, profile: null }; }
    if (!data.user) { signingInRef.current = false; setLoading(false); return { error: 'Sign in failed. Please try again.', profile: null }; }

    setUser(data.user);
    const prof = await loadProfile(data.user.id);
    signingInRef.current = false;
    return { error: null, profile: prof };
  }, [loadProfile]);

  const signUp = useCallback(async (
    email: string,
    password: string,
    profileData: Partial<Profile> & { full_name: string; phone: string; role: UserRole }
  ) => {
    setLoading(true);
    setProfile(null);
    profileUidRef.current = null;
    signingInRef.current = true;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { signingInRef.current = false; setLoading(false); return { error: error.message, profile: null }; }
    if (!data.user) { signingInRef.current = false; setLoading(false); return { error: 'Sign up failed. Please try again.', profile: null }; }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      email,
      ...profileData,
    });
    if (profileError) {
      await supabase.auth.signOut();
      signingInRef.current = false;
      setLoading(false);
      return { error: `Failed to create profile: ${profileError.message}`, profile: null };
    }

    setUser(data.user);
    const prof = { id: data.user.id, ...profileData } as unknown as Profile;
    profileUidRef.current = data.user.id;
    setProfile(prof);
    signingInRef.current = false;
    setLoading(false);
    sendWelcomeEmail(data.user.id, email, profileData.full_name);
    return { error: null, profile: prof };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    profileUidRef.current = null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.id);
    }
  }, [user, loadProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    user, profile, loading, signIn, signUp, signOut, refreshProfile,
  }), [user, profile, loading, signIn, signUp, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

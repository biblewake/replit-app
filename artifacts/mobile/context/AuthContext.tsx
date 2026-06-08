/**
 * AuthContext — Supabase authentication for Bible Wake.
 *
 * Exposes: session, user, profile, signInWithGoogle(), signInWithApple(), signOut()
 *
 * REQUIRED SUPABASE DASHBOARD STEPS (after adding secrets):
 *   Authentication → Providers:
 *   1. Google — enable and paste your Google OAuth Client ID + Secret
 *      (Create credentials at console.cloud.google.com → APIs & Services → Credentials)
 *   2. Apple — enable and paste your Apple Service ID + Secret Key
 *      (Requires Apple Developer account → Certificates, IDs & Profiles)
 *
 * REQUIRED APP SCHEME (app.json):
 *   Add "scheme": "biblewake" to app.json so OAuth redirects work on native.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert, Platform } from "react-native";
import { Session, User } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { syncOnboardingAnswers } from "@/services/onboardingSync";

// Required for OAuth on native — allows the browser to close and return to the app
WebBrowser.maybeCompleteAuthSession();

export interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  preferred_translation: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  /** True once onboarding has been completed (AsyncStorage `onboarding_complete`). null while loading. */
  onboardingComplete: boolean | null;
  /**
   * True when the user chose "Continue without an account" in a non-Supabase
   * environment (e.g. Expo Go). In production Supabase creates a real anonymous
   * session instead, so this flag stays false.
   */
  isGuest: boolean;
  /** Mark onboarding done — persists the flag and flips the gate. */
  completeOnboarding: () => Promise<void>;
  /** Update a subset of the user's profile (persists to Supabase and updates local state). */
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  onboardingComplete: null,
  isGuest: false,
  completeOnboarding: async () => {},
  updateProfile: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signInAnonymously: async () => {},
  signOut: async () => {},
});

/** AsyncStorage key that gates the onboarding flow. */
const ONBOARDING_COMPLETE_KEY = "onboarding_complete";

/** Flag stored in AsyncStorage to track whether migration has been run on this device */
const MIGRATION_DONE_KEY = "@bible_wake_supabase_migration_v1";

/**
 * After first sign-in: ensure the public.users row exists.
 * Creates it if missing (using UPSERT to be safe on repeat calls).
 */
async function ensureUserRow(user: User): Promise<void> {
  await supabase.from("users").upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name:
        user.user_metadata?.full_name ??
        user.user_metadata?.name ??
        null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );
}

/**
 * One-time migration: read AsyncStorage alarms + streak values,
 * upsert them into Supabase, then set a "migration done" flag
 * so this only runs once per device.
 */
async function migrateLocalDataToSupabase(userId: string): Promise<void> {
  try {
    const already = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
    if (already) return;

    // Read existing local data
    const [alarmsRaw, streakRaw, longestRaw] = await Promise.all([
      AsyncStorage.getItem("@bible_wake_alarms"),
      AsyncStorage.getItem("@bible_wake_streak"),
      AsyncStorage.getItem("@bible_wake_longest_streak"),
    ]);

    // Migrate alarms
    if (alarmsRaw) {
      const alarms = JSON.parse(alarmsRaw) as Array<{
        id: string;
        hour: number;
        minute: number;
        isPM: boolean;
        days: boolean[];
        name: string;
        verseRef?: string;
        verseText?: string;
        enabled: boolean;
        alarmType?: string;
        scheduleType?: string;
        wakeUpCheck?: boolean;
        soundId?: string;
        verseMode?: string;
      }>;

      if (alarms.length > 0) {
        const rows = alarms.map((a) => ({
          // Use the local id as a stable identifier — we upsert so re-running is safe.
          // NOTE: local IDs are timestamp-based strings, not UUIDs.
          // We generate a deterministic-enough approach by just inserting fresh rows.
          user_id: userId,
          name: a.name ?? null,
          hour: a.hour,
          minute: a.minute,
          is_pm: a.isPM,
          days: a.days,
          alarm_type: (a.alarmType ?? "verse") as "verse" | "normal",
          schedule_type: (a.scheduleType ?? "scheduled") as
            | "scheduled"
            | "one-time",
          enabled: a.enabled,
          verse_ref: a.verseRef ?? null,
          verse_text: a.verseText ?? null,
          verse_mode: (a.verseMode ?? null) as "memory" | "declare" | null,
          sound_id: a.soundId ?? null,
          wake_up_check: a.wakeUpCheck ?? false,
        }));

        await supabase.from("alarms").insert(rows);
      }
    }

    // Migrate streak
    const currentStreak = streakRaw ? parseInt(streakRaw, 10) : 0;
    const longestStreak = longestRaw ? parseInt(longestRaw, 10) : 0;

    if (currentStreak > 0 || longestStreak > 0) {
      await supabase.from("streaks").upsert(
        {
          user_id: userId,
          current_streak: currentStreak,
          longest_streak: longestStreak,
        },
        { onConflict: "user_id" }
      );
    }

    await AsyncStorage.setItem(MIGRATION_DONE_KEY, "1");
  } catch (err) {
    // Migration failure is non-fatal — local data is still available as fallback
    console.warn("[BibleWake] Local data migration failed:", err);
  }
}

/** Fetch the user's profile from public.users */
async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from("users")
    .select("id, display_name, email, avatar_url, preferred_translation")
    .eq("id", userId)
    .single();
  return data ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(
    null
  );

  // Load the onboarding gate flag once on mount.
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((val) => setOnboardingComplete(val === "1"))
      .catch(() => setOnboardingComplete(false));
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
    } catch {
      // non-fatal — gate still flips in memory for this session
    }
    setOnboardingComplete(true);
  }, []);

  // Handle auth state changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await ensureUserRow(session.user);
          await migrateLocalDataToSupabase(session.user.id);
          const p = await fetchProfile(session.user.id);
          setProfile(p);
          // Fire-and-forget: push any locally-stored onboarding answers now that
          // a session exists (e.g. user skipped auth during onboarding).
          void syncOnboardingAnswers(supabase, session.user.id);
        } else {
          setProfile(null);
        }

        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /**
   * GOOGLE SIGN-IN
   *
   * Before this works:
   *   1. Supabase Dashboard → Auth → Providers → Google → Enable
   *   2. Paste your Google OAuth Client ID and Secret
   *      (Get from console.cloud.google.com → APIs & Services → Credentials)
   *   3. Add your app's redirect URI to the Google OAuth client's authorized redirect URIs:
   *      https://<your-supabase-project>.supabase.co/auth/v1/callback
   */
  const signInWithGoogle = useCallback(async () => {
    try {
      let makeRedirectUri: ((opts: { scheme: string }) => string) | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        makeRedirectUri = require("expo-auth-session").makeRedirectUri;
      } catch {
        Alert.alert(
          "Not available",
          "Google sign-in requires a production build. It is not supported in Expo Go."
        );
        return;
      }
      const redirectTo = makeRedirectUri!({ scheme: "mobile" });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("No OAuth URL returned");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type === "success" && result.url) {
        // Try query params first, then fragment (#access_token=...)
        const fragment = result.url.split("#")[1] ?? "";
        const params = new URLSearchParams(fragment);
        const at = params.get("access_token");
        const rt = params.get("refresh_token");
        if (at && rt) {
          await supabase.auth.setSession({
            access_token: at,
            refresh_token: rt,
          });
        }
      }
    } catch (error) {
      console.error("[BibleWake] Google sign-in error:", error);
      Alert.alert(
        "Sign-in failed",
        "Could not sign in with Google. Please try again."
      );
    }
  }, []);

  /**
   * APPLE SIGN-IN
   *
   * Before this works:
   *   1. Supabase Dashboard → Auth → Providers → Apple → Enable
   *   2. Paste your Apple Service ID and Private Key
   *      (Get from developer.apple.com → Certificates, IDs & Profiles)
   *   3. Register your app's redirect URI with Apple
   */
  const signInWithApple = useCallback(async () => {
    try {
      let makeRedirectUri: ((opts: { scheme: string }) => string) | undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        makeRedirectUri = require("expo-auth-session").makeRedirectUri;
      } catch {
        Alert.alert(
          "Not available",
          "Apple sign-in requires a production build. It is not supported in Expo Go."
        );
        return;
      }
      const redirectTo = makeRedirectUri!({ scheme: "mobile" });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "apple",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("No OAuth URL returned");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      if (result.type === "success" && result.url) {
        const fragment = result.url.split("#")[1] ?? "";
        const params = new URLSearchParams(fragment);
        const at = params.get("access_token");
        const rt = params.get("refresh_token");
        if (at && rt) {
          await supabase.auth.setSession({
            access_token: at,
            refresh_token: rt,
          });
        }
      }
    } catch (error) {
      console.error("[BibleWake] Apple sign-in error:", error);
      Alert.alert(
        "Sign-in failed",
        "Could not sign in with Apple. Please try again."
      );
    }
  }, []);

  const signInAnonymously = useCallback(async () => {
    // When Supabase is not configured (e.g. Expo Go without secrets), skip the
    // network call entirely. The stub client would return { error: null } but
    // never fire onAuthStateChange, so the AccountScreen would hang forever.
    // Instead, set the in-memory guest flag — AccountScreen watches it to advance.
    if (!isSupabaseConfigured) {
      setIsGuest(true);
      return;
    }

    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
    } catch (error) {
      console.error("[BibleWake] Anonymous sign-in error:", error);
      Alert.alert(
        "Sign-in failed",
        "Could not continue anonymously. Please try again."
      );
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) return;
    // Optimistic local update
    setProfile((prev) => prev ? { ...prev, ...updates } : prev);
    try {
      await supabase
        .from("users")
        .update(updates)
        .eq("id", user.id);
    } catch (err) {
      console.warn("[BibleWake] Failed to update profile:", err);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        isGuest,
        onboardingComplete,
        completeOnboarding,
        updateProfile,
        signInWithGoogle,
        signInWithApple,
        signInAnonymously,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

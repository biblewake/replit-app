/**
 * Supabase client singleton for Bible Wake.
 *
 * ══════════════════════════════════════════════════════════════
 * REQUIRED SECRETS — add in Replit Secrets panel (3 variables):
 * ══════════════════════════════════════════════════════════════
 *
 *   EXPO_PUBLIC_SUPABASE_URL        — your project URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY   — your publishable key (previously called
 *                                     "anon key" — same key, new label in
 *                                     the Supabase dashboard)
 *   SUPABASE_SERVICE_ROLE_KEY       — service role key (server-side only,
 *                                     never bundled into the app)
 *
 * NOTE ON NAMING: Expo requires the EXPO_PUBLIC_ prefix for any environment
 * variable that needs to be accessible inside the app bundle. The task spec
 * names SUPABASE_URL and SUPABASE_ANON_KEY are also checked as fallbacks for
 * use in server-side / CLI contexts, but they will be undefined in the Expo
 * runtime unless you prefix them with EXPO_PUBLIC_.
 *
 * HOW TO GET THESE VALUES:
 *   1. Go to https://supabase.com → Create new project (free tier is fine)
 *   2. Settings → API → copy "Project URL" and "Publishable key"
 *      (the Publishable key is what Supabase previously called the anon key —
 *      it's safe to use in client-side code)
 *   3. Add them as Replit Secrets with the names above
 *
 * AFTER ADDING SECRETS — Supabase Dashboard setup:
 *   1. SQL Editor → paste the contents of
 *      artifacts/mobile/supabase/migrations/001_schema.sql → Run
 *   2. Auth → Providers → Google → Enable; paste Client ID + Secret
 *      (create at console.cloud.google.com → APIs → Credentials)
 *   3. Auth → Providers → Apple → Enable; paste Service ID + Secret Key
 *      (from developer.apple.com → Certs, IDs & Profiles)
 *
 * WITHOUT SECRETS:
 *   The app runs in guest mode — all data stored locally via AsyncStorage.
 *   A diagnostic warning is emitted at startup listing the missing variables.
 *   Sign-in features are hidden in the UI until secrets are added.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// ── Resolve environment variables ─────────────────────────────────────────────
// Support both the task-specified names (SUPABASE_URL / SUPABASE_ANON_KEY) and
// the Expo-required EXPO_PUBLIC_ variants.  EXPO_PUBLIC_ is the canonical form
// for client-side use; the unprefixed vars are checked as well so the naming
// described in the task spec works in server / CLI contexts.

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  null;

const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  null;

// ── Startup secrets gate ──────────────────────────────────────────────────────
// Check that both required vars are present and emit a clear diagnostic
// listing exactly which variable(s) are missing.  The app continues in
// guest mode (AsyncStorage only) so that the app remains usable while
// the user completes their Supabase setup.

const missingVars: string[] = [];
if (!supabaseUrl) missingVars.push("EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL)");
if (!supabaseAnonKey) missingVars.push("EXPO_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)");

if (missingVars.length > 0) {
  const lines = [
    "[BibleWake] ⚠️  Supabase secrets are not configured.",
    "The app will run in guest-only mode (local AsyncStorage) until you add:",
    ...missingVars.map((v) => `  • ${v}`),
    "Add them via Replit Secrets → see artifacts/mobile/lib/supabase.ts for details.",
  ];
  // Use console.error so it stands out clearly in the Metro/Expo dev console
  console.error(lines.join("\n"));
}

/**
 * True when Supabase URL and anon key are both present.
 * All auth and cloud-sync features are gated behind this flag.
 * Guest mode (AsyncStorage only) is used when false.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
console.log(`[BibleWake] Supabase configured: ${isSupabaseConfigured}, url prefix: ${supabaseUrl?.slice(0, 20) ?? "unset"}`);

// ── Session storage adapter ───────────────────────────────────────────────────
/**
 * ExpoSecureStoreAdapter — encrypted keychain on native, AsyncStorage on web.
 * (SecureStore is not available on web, so we fall back gracefully.)
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === "web") return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// ── Supabase client ───────────────────────────────────────────────────────────
/**
 * The Supabase client. When `isSupabaseConfigured` is false this is a no-op
 * stub — all methods resolve immediately without network calls so downstream
 * code stays simple (no null-checks needed everywhere).
 */
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : // ── Stub client ── returned when secrets are not configured.
    // Auth methods return "no session"; DB methods return an error payload.
    // The app treats these like a network failure and falls back to AsyncStorage.
    ({
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
        signOut: async () => ({ error: null }),
        signInWithOAuth: async () => ({ data: { url: null }, error: null }),
        signInAnonymously: async () => ({ data: { session: null, user: null }, error: null }),
        setSession: async () => ({ data: { session: null }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
            single: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
          }),
          single: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
          }),
        }),
        upsert: () => Promise.resolve({ data: null, error: new Error("Supabase not configured") }),
      }),
    } as unknown as SupabaseClient);

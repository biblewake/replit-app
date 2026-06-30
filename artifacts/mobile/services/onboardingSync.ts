import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupabaseClient } from "@supabase/supabase-js";

/** AsyncStorage key holding the locally-collected onboarding quiz answers. */
export const ONBOARDING_ANSWERS_KEY = "onboarding_answers";

/**
 * Fire-and-forget background sync of onboarding answers to Supabase.
 *
 * Reads the locally-stored answers map, upserts a single row for the user into
 * `public.onboarding_answers`, and clears the local copy on success so it is
 * never re-synced. Safe to call without awaiting — all failures are swallowed
 * so the UI path is never blocked.
 */
export async function syncOnboardingAnswers(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_ANSWERS_KEY);
    if (!raw) return;

    let answers: Record<string, unknown>;
    try {
      answers = JSON.parse(raw);
    } catch {
      // Corrupt payload — drop it so we don't retry forever.
      await AsyncStorage.removeItem(ONBOARDING_ANSWERS_KEY);
      return;
    }

    const { error } = await supabaseClient
      .from("onboarding_answers")
      .upsert(
        { user_id: userId, answers },
        { onConflict: "user_id", ignoreDuplicates: false }
      );

    if (error) {
      console.warn("[onboardingSync] upsert failed:", error.message ?? String(error));
    } else {
      await AsyncStorage.removeItem(ONBOARDING_ANSWERS_KEY);
    }
  } catch (err) {
    // Network or storage error — leave the local copy in place for next launch.
    console.warn("[onboardingSync] sync error:", err);
  }
}

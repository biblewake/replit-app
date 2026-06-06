/**
 * Wake History & Verse Stats helpers.
 *
 * Call recordWakeEvent() after each alarm dismissal to persist
 * the event to Supabase (when authenticated) and update verse_stats + streaks.
 */

import { supabase } from "@/lib/supabase";

export interface WakeEventPayload {
  userId: string;
  alarmId?: string | null;
  alarmName?: string | null;
  verseRef?: string | null;
  verseText?: string | null;
  verseMode?: "memory" | "declare" | null;
  /** Was the alarm a wake-up phrase check? */
  wakeUpCheckRequired?: boolean;
  wakeUpCheckCompleted?: boolean;
  wakeUpPhraseAttempts?: number;
  /** Verse recital data (null for normal / wake-up-only alarms) */
  recitalTranscript?: string | null;
  recitalAccuracy?: number | null;
  recitalDurationSeconds?: number | null;
  recitalSuccess?: boolean | null;
  verseBackgroundImageId?: string | null;
}

/**
 * Insert a wake_history row and upsert the corresponding verse_stats row.
 * Also updates the streak (current + longest).
 *
 * Safe to call when unauthenticated — will no-op silently.
 */
export async function recordWakeEvent(payload: WakeEventPayload): Promise<void> {
  const {
    userId,
    alarmId,
    alarmName,
    verseRef,
    verseText,
    verseMode,
    wakeUpCheckRequired = false,
    wakeUpCheckCompleted = false,
    wakeUpPhraseAttempts = 0,
    recitalTranscript,
    recitalAccuracy,
    recitalDurationSeconds,
    recitalSuccess,
    verseBackgroundImageId,
  } = payload;

  try {
    // 1. Insert wake_history row
    await supabase.from("wake_history").insert({
      user_id: userId,
      alarm_id: alarmId ?? null,
      alarm_name: alarmName ?? null,
      dismissed_at: new Date().toISOString(),
      verse_ref: verseRef ?? null,
      verse_text: verseText ?? null,
      verse_mode: verseMode ?? null,
      wake_up_check_required: wakeUpCheckRequired,
      wake_up_check_completed: wakeUpCheckCompleted,
      wake_up_phrase_attempts: wakeUpPhraseAttempts,
      recital_transcript: recitalTranscript ?? null,
      recital_accuracy: recitalAccuracy ?? null,
      recital_duration_seconds: recitalDurationSeconds ?? null,
      recital_success: recitalSuccess ?? null,
      verse_background_image_id: verseBackgroundImageId ?? null,
    });

    // 2. Upsert verse_stats (only meaningful for verse alarms with a verse ref)
    if (verseRef) {
      const isMemorized =
        verseMode === "memory" && recitalSuccess === true;

      // Fetch existing row first to compute increments
      const { data: existing } = await supabase
        .from("verse_stats")
        .select("*")
        .eq("user_id", userId)
        .eq("verse_ref", verseRef)
        .single();

      const timesShown = (existing?.times_shown ?? 0) + 1;
      const timesRecited =
        (existing?.times_recited ?? 0) +
        (recitalDurationSeconds != null ? 1 : 0);
      const timesSucceeded =
        (existing?.times_succeeded ?? 0) + (recitalSuccess ? 1 : 0);
      const totalRecitalSeconds =
        (existing?.total_recital_seconds ?? 0) +
        (recitalDurationSeconds ?? 0);

      const alreadyMemorized = existing?.is_memorized ?? false;
      const memorizedAt =
        isMemorized && !alreadyMemorized
          ? new Date().toISOString()
          : (existing?.memorized_at ?? null);

      await supabase.from("verse_stats").upsert(
        {
          user_id: userId,
          verse_ref: verseRef,
          verse_text: verseText ?? existing?.verse_text ?? null,
          times_shown: timesShown,
          times_recited: timesRecited,
          times_succeeded: timesSucceeded,
          total_recital_seconds: totalRecitalSeconds,
          is_memorized: alreadyMemorized || isMemorized,
          memorized_at: memorizedAt,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,verse_ref" }
      );
    }

    // 3. Update streak — only increment when the recital was passed
    if (recitalSuccess === true) {
      await updateStreak(userId);
    }
  } catch (err) {
    // Non-fatal — local streak state is updated separately via AlarmContext
    console.warn("[BibleWake] Failed to record wake event in Supabase:", err);
  }
}

/**
 * Update current_streak and longest_streak in public.streaks.
 * Increments streak if last_wake_date is yesterday or today (idempotent).
 */
async function updateStreak(userId: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

  const { data: existing } = await supabase
    .from("streaks")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!existing) {
    // First wake event
    await supabase.from("streaks").insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_wake_date: today,
    });
    return;
  }

  const lastWakeDate = existing.last_wake_date as string | null;

  if (lastWakeDate === today) {
    // Already recorded today — don't double-increment
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const nextStreak =
    lastWakeDate === yesterdayStr
      ? existing.current_streak + 1
      : 1; // streak broken — reset to 1

  const longestStreak = Math.max(existing.longest_streak, nextStreak);

  await supabase.from("streaks").update({
    current_streak: nextStreak,
    longest_streak: longestStreak,
    last_wake_date: today,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
}

/**
 * Fetch a random active verse_background_image_id from Supabase.
 * Returns null if no rows exist or request fails.
 */
export async function pickRandomVerseBackground(): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("verse_background_images")
      .select("id")
      .eq("is_active", true);

    if (!data || data.length === 0) return null;
    const idx = Math.floor(Math.random() * data.length);
    return data[idx].id as string;
  } catch {
    return null;
  }
}

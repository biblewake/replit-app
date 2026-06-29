/**
 * AlarmContext — manages alarms and streaks.
 *
 * When the user is authenticated (session via AuthContext):
 *   - Alarms are read from / written to Supabase (public.alarms, public.streaks)
 *   - Falls back to AsyncStorage seamlessly on fetch errors
 *
 * When in guest mode (no session):
 *   - Reads/writes exclusively from AsyncStorage (original behaviour preserved)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { pickRandomVerseBackground } from "@/lib/wakeHistory";
import {
  cancelAlarmNotifications,
  scheduleAlarmNotifications,
} from "@/lib/alarmScheduler";
import {
  scheduleAlarmKit,
  cancelAlarmKit,
  requestAlarmKitPermission,
  type AlarmKitScheduleResult,
} from "@/lib/alarmKitScheduler";

export interface Alarm {
  id: string;
  hour: number;
  minute: number;
  isPM: boolean;
  days: boolean[];
  name: string;
  verseRef: string;
  verseText: string;
  enabled: boolean;
  alarmType?: "verse" | "normal";
  scheduleType?: "scheduled" | "one-time";
  wakeUpCheck?: boolean;
  soundId?: string;
  verseMode?: "memory" | "declare";
  /** Supabase ID (uuid) — present when authenticated */
  supabaseId?: string;
  /** Linked background image id */
  verseBackgroundImageId?: string | null;
}

const STORAGE_KEY = "@bible_wake_alarms";
const STREAK_KEY = "@bible_wake_streak";
const LONGEST_STREAK_KEY = "@bible_wake_longest_streak";
const LAST_WAKE_DATE_KEY = "@bible_wake_last_wake_date";
/** Written for both guest and authenticated users so the background task can read it. */
export const ALARM_CACHE_KEY = "@bible_wake_alarms_cache";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}


export interface AddAlarmResult {
  success: boolean;
  error?: string;
}

interface AlarmContextType {
  alarms: Alarm[];
  addAlarm: (alarm: Omit<Alarm, "id">) => Promise<AddAlarmResult>;
  updateAlarm: (id: string, updates: Partial<Alarm>) => Promise<AddAlarmResult>;
  deleteAlarm: (id: string) => void;
  toggleAlarm: (id: string) => void;
  getNextAlarm: () => Alarm | null;
  streak: number;
  longestStreak: number;
  incrementStreak: (recitalSuccess?: boolean) => void;
  /** Whether alarms are loaded from their source (Supabase or AsyncStorage) */
  isLoaded: boolean;
  /**
   * iOS 26+: true when the user has denied the Alarms permission to AlarmKit.
   * Surface a settings sheet so the user can re-enable it.
   * Always false on Android.
   */
  alarmKitDenied: boolean;
  /** Call after the user dismisses the denied-permission sheet to reset the flag. */
  clearAlarmKitDenied: () => void;
  /**
   * iOS 26+: true when AlarmKit scheduling returned "error" or "unavailable" —
   * meaning configure() failed (App Group not set up) or the native module is
   * missing from the build. Alarms are saved but will not ring. Surface a
   * persistent banner on the Alarms tab so the user knows something is wrong.
   * Always false on Android.
   */
  alarmKitConfigureError: boolean;
  /** Dismiss the configure-error banner. */
  clearAlarmKitConfigureError: () => void;
}

const AlarmContext = createContext<AlarmContextType>({
  alarms: [],
  addAlarm: () => Promise.resolve({ success: true }),
  updateAlarm: () => Promise.resolve({ success: true }),
  deleteAlarm: () => {},
  toggleAlarm: () => {},
  getNextAlarm: () => null,
  streak: 1,
  longestStreak: 1,
  incrementStreak: (_recitalSuccess?: boolean) => {},
  isLoaded: false,
  alarmKitDenied: false,
  clearAlarmKitDenied: () => {},
  alarmKitConfigureError: false,
  clearAlarmKitConfigureError: () => {},
});

// ── Supabase helpers ───────────────────────────────────────────────────────────

/** Map a Supabase alarms row → local Alarm type */
function rowToAlarm(row: Record<string, unknown>): Alarm {
  return {
    id: (row.id as string) ?? generateId(),
    supabaseId: row.id as string,
    hour: row.hour as number,
    minute: row.minute as number,
    isPM: row.is_pm as boolean,
    days: (row.days as boolean[]) ?? [false, false, false, false, false, false, false],
    name: (row.name as string) ?? "",
    verseRef: (row.verse_ref as string) ?? "",
    verseText: (row.verse_text as string) ?? "",
    enabled: (row.enabled as boolean) ?? true,
    alarmType: (row.alarm_type as "verse" | "normal") ?? "verse",
    scheduleType: (row.schedule_type as "scheduled" | "one-time") ?? "scheduled",
    wakeUpCheck: (row.wake_up_check as boolean) ?? false,
    soundId: (row.sound_id as string | null) ?? undefined,
    verseMode: (row.verse_mode as "memory" | "declare" | null) ?? undefined,
    verseBackgroundImageId: (row.verse_background_image_id as string | null) ?? null,
  };
}

/** Map a local Alarm → Supabase insert/update payload */
function alarmToRow(alarm: Omit<Alarm, "id">, userId: string) {
  return {
    user_id: userId,
    name: alarm.name ?? null,
    hour: alarm.hour,
    minute: alarm.minute,
    is_pm: alarm.isPM,
    days: alarm.days,
    alarm_type: alarm.alarmType ?? "verse",
    schedule_type: alarm.scheduleType ?? "scheduled",
    enabled: alarm.enabled,
    verse_ref: alarm.verseRef ?? null,
    verse_text: alarm.verseText ?? null,
    verse_mode: alarm.verseMode ?? null,
    sound_id: alarm.soundId ?? null,
    wake_up_check: alarm.wakeUpCheck ?? false,
    verse_background_image_id: alarm.verseBackgroundImageId ?? null,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

// AsyncStorage key that marks the one-time legacy iOS notification migration as done.
const LEGACY_NOTIF_MIGRATION_KEY = "@legacy_notif_migration_alarmkit_v1";

/**
 * One-time migration for iOS: when upgrading from a pre-AlarmKit build, cancel
 * all previously scheduled expo-notifications alarms so they don't double-fire
 * alongside AlarmKit alarms.  Guarded by AsyncStorage so it runs exactly once.
 */
async function cancelLegacyIosNotifications(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const done = await AsyncStorage.getItem(LEGACY_NOTIF_MIGRATION_KEY);
    if (done) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem(LEGACY_NOTIF_MIGRATION_KEY, "done");
  } catch {
    // Non-fatal — worst case, duplicate notifications fire until next launch.
  }
}

function cancelForPlatform(alarmId: string): Promise<void> {
  if (Platform.OS === "ios") {
    // Belt-and-suspenders: cancel both AlarmKit UUID and any legacy notification
    // IDs for this alarm.  Keeps delete/update/toggle safe during the migration
    // window when an old notification may still be scheduled for the same alarm.
    return Promise.all([
      cancelAlarmKit(alarmId),
      cancelAlarmNotifications(alarmId),
    ]).then(() => {});
  }
  return cancelAlarmNotifications(alarmId);
}

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [lastWakeDate, setLastWakeDate] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [alarmKitDenied, setAlarmKitDenied] = useState(false);
  const [alarmKitConfigureError, setAlarmKitConfigureError] = useState(false);

  // ── iOS legacy notification migration (runs once on first AlarmKit launch) ────
  useEffect(() => {
    cancelLegacyIosNotifications();
  }, []);

  // ── Detect auth state ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Load alarms (Supabase when authed, AsyncStorage in guest mode) ───────────
  useEffect(() => {
    setLoaded(false);

    if (userId) {
      // Authenticated — load from Supabase
      Promise.resolve(
        supabase
          .from("alarms")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
      )
        .then(({ data, error }) => {
          if (error || !data) {
            return AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
              setAlarms(raw ? JSON.parse(raw) : []);
            });
          }
          setAlarms(data.length > 0 ? data.map(rowToAlarm) : []);
        })
        .catch(() => {
          AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
            setAlarms(raw ? JSON.parse(raw) : []);
          });
        })
        .finally(() => setLoaded(true));

      // Load streak from Supabase
      Promise.resolve(
        supabase
          .from("streaks")
          .select("current_streak, longest_streak, last_wake_date")
          .eq("user_id", userId)
          .single()
      )
        .then(({ data }) => {
          if (data) {
            setStreak(data.current_streak ?? 0);
            setLongestStreak(data.longest_streak ?? 0);
            if (data.last_wake_date) setLastWakeDate(data.last_wake_date as string);
          }
        })
        .catch(() => {});
    } else {
      // Guest mode — AsyncStorage
      Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(LONGEST_STREAK_KEY),
        AsyncStorage.getItem(LAST_WAKE_DATE_KEY),
      ])
        .then(([data, streakVal, longestVal, lastWakeDateVal]) => {
          setAlarms(data ? JSON.parse(data) : []);
          if (streakVal !== null) setStreak(parseInt(streakVal, 10));
          if (longestVal !== null) setLongestStreak(parseInt(longestVal, 10));
          if (lastWakeDateVal !== null) setLastWakeDate(lastWakeDateVal);
        })
        .catch(() => setAlarms([]))
        .finally(() => setLoaded(true));
    }
  }, [userId]);

  // ── Persist to AsyncStorage when in guest mode ───────────────────────────────
  useEffect(() => {
    if (loaded && !userId) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms)).catch(() => {});
    }
  }, [alarms, loaded, userId]);

  // ── Universal alarm cache (for both auth modes) ───────────────────────────
  // The background fetch task reads from ALARM_CACHE_KEY since authenticated
  // users don't have their alarms persisted to STORAGE_KEY.
  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(ALARM_CACHE_KEY, JSON.stringify(alarms)).catch(() => {});
    }
  }, [alarms, loaded]);

  // ── Streak (local + Supabase) ─────────────────────────────────────────────────
  const incrementStreak = useCallback((recitalSuccess?: boolean) => {
    // Guard: only verse alarms with a passed recital increment the streak
    if (recitalSuccess === false) return;

    const today = new Date().toISOString().split("T")[0];

    // Same-day guard: if already incremented today, skip to avoid double-counting
    if (lastWakeDate === today) return;

    // Update lastWakeDate immediately to prevent races
    setLastWakeDate(today);
    AsyncStorage.setItem(LAST_WAKE_DATE_KEY, today).catch(() => {});

    setStreak((prev) => {
      const next = prev + 1;

      // Update local storage (guest mode fallback)
      AsyncStorage.setItem(STREAK_KEY, String(next)).catch(() => {});

      setLongestStreak((longest) => {
        const newLongest = next > longest ? next : longest;
        AsyncStorage.setItem(LONGEST_STREAK_KEY, String(newLongest)).catch(() => {});

        // Update Supabase streak if authenticated
        if (userId) {
          Promise.resolve(
            supabase.from("streaks").upsert(
              {
                user_id: userId,
                current_streak: next,
                longest_streak: newLongest,
                last_wake_date: today,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" }
            )
          ).catch(() => {});
        }

        return newLongest;
      });
      return next;
    });
  }, [userId, lastWakeDate]);

  // ── Unified platform scheduling (inside provider — can access setAlarmKitDenied) ──
  // Used by all user-initiated scheduling paths: addAlarm, updateAlarm, toggleAlarm.
  // On iOS, calls scheduleAlarmKit (which requests authorization on first call) and
  // surfaces alarmKitDenied=true when the user has denied Alarms permission.
  const scheduleOnPlatform = useCallback(async (alarm: Alarm): Promise<void> => {
    if (Platform.OS === "ios") {
      const result: AlarmKitScheduleResult = await scheduleAlarmKit(alarm).catch(
        () => "error" as AlarmKitScheduleResult
      );
      if (result === "denied") {
        setAlarmKitDenied(true);
      } else if (result === "error" || result === "unavailable") {
        // "error"       → configure() returned false (App Group not registered in
        //                 the provisioning profile — one-time manual setup needed).
        // "unavailable" → native module missing from the build (should not happen
        //                 on a production device build, but surfaces gracefully).
        // In both cases the alarm is saved but will not ring. Surface a persistent
        // banner instead of a transient Alert so the user can see the state at any
        // time without dismissing something.
        setAlarmKitConfigureError(true);
      }
    } else {
      scheduleAlarmNotifications(alarm).catch(() => {});
    }
  }, []);

  // ── CRUD operations ───────────────────────────────────────────────────────────

  const addAlarm = useCallback(
    async (alarm: Omit<Alarm, "id">): Promise<AddAlarmResult> => {
      // ── Permission gate ──────────────────────────────────────────────────────
      // Check before persisting: a denied permission means the alarm would
      // silently never fire, which is worse than blocking the save.
      if (Platform.OS === "ios") {
        const status = await requestAlarmKitPermission();
        if (status === "denied") {
          setAlarmKitDenied(true);
          return {
            success: false,
            error:
              "Alarm permission is required. Please allow Alarms for Bible Wake in Settings so your alarm can wake you up.",
          };
        }
      } else if (Platform.OS === "android") {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          return {
            success: false,
            error:
              "Notification permission is required to schedule alarms. Please allow notifications for Bible Wake in Settings.",
          };
        }
      }

      let newAlarm: Alarm;

      if (userId) {
        // If this is a verse alarm, try to pick a random background image
        let verseBackgroundImageId = alarm.verseBackgroundImageId ?? null;
        if (alarm.alarmType === "verse" && alarm.verseRef && !verseBackgroundImageId) {
          verseBackgroundImageId = await pickRandomVerseBackground();
        }

        const row = alarmToRow(
          { ...alarm, verseBackgroundImageId },
          userId
        );
        const { data, error } = await supabase
          .from("alarms")
          .insert(row)
          .select()
          .single();

        if (!error && data) {
          newAlarm = rowToAlarm(data);
          setAlarms((prev) => [...prev, newAlarm]);
          await scheduleOnPlatform(newAlarm);
          return { success: true };
        }
      }

      // Guest mode or Supabase error — local only
      newAlarm = { ...alarm, id: generateId() };
      setAlarms((prev) => [...prev, newAlarm]);
      await scheduleOnPlatform(newAlarm);
      return { success: true };
    },
    [userId, scheduleOnPlatform]
  );

  const updateAlarm = useCallback(
    async (id: string, updates: Partial<Alarm>): Promise<AddAlarmResult> => {
      // ── Permission gate (same as addAlarm) ──────────────────────────────────
      if (Platform.OS === "ios") {
        const status = await requestAlarmKitPermission();
        if (status === "denied") {
          setAlarmKitDenied(true);
          return {
            success: false,
            error:
              "Alarm permission is required. Please allow Alarms for Bible Wake in Settings so your alarm can wake you up.",
          };
        }
      } else if (Platform.OS === "android") {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          return {
            success: false,
            error:
              "Notification permission is required to schedule alarms. Please allow notifications for Bible Wake in Settings.",
          };
        }
      }

      // Capture the computed alarm outside setAlarms so we can schedule after state update.
      let alarmToSchedule: Alarm | undefined;
      setAlarms((prev) => {
        const updated = prev.map((a) => (a.id === id ? { ...a, ...updates } : a));
        alarmToSchedule = updated.find((a) => a.id === id);
        return updated;
      });
      if (alarmToSchedule) {
        scheduleOnPlatform(alarmToSchedule).catch(() => {});
      }

      if (userId) {
        // Convert camelCase updates to snake_case for Supabase
        const patch: Record<string, unknown> = {};
        if ("name" in updates) patch.name = updates.name;
        if ("hour" in updates) patch.hour = updates.hour;
        if ("minute" in updates) patch.minute = updates.minute;
        if ("isPM" in updates) patch.is_pm = updates.isPM;
        if ("days" in updates) patch.days = updates.days;
        if ("alarmType" in updates) patch.alarm_type = updates.alarmType;
        if ("scheduleType" in updates) patch.schedule_type = updates.scheduleType;
        if ("enabled" in updates) patch.enabled = updates.enabled;
        if ("verseRef" in updates) patch.verse_ref = updates.verseRef;
        if ("verseText" in updates) patch.verse_text = updates.verseText;
        if ("verseMode" in updates) patch.verse_mode = updates.verseMode;
        if ("soundId" in updates) patch.sound_id = updates.soundId;
        if ("wakeUpCheck" in updates) patch.wake_up_check = updates.wakeUpCheck;
        if ("verseBackgroundImageId" in updates)
          patch.verse_background_image_id = updates.verseBackgroundImageId;

        if (Object.keys(patch).length > 0) {
          Promise.resolve(
            supabase
              .from("alarms")
              .update(patch)
              .eq("id", id)
              .eq("user_id", userId)
          ).catch(() => {});
        }
      }

      return { success: true };
    },
    [userId, scheduleOnPlatform]
  );

  const deleteAlarm = useCallback(
    (id: string) => {
      setAlarms((prev) => prev.filter((a) => a.id !== id));
      cancelForPlatform(id).catch(() => {});

      if (userId) {
        Promise.resolve(
          supabase
            .from("alarms")
            .delete()
            .eq("id", id)
            .eq("user_id", userId)
        ).catch(() => {});
      }
    },
    [userId]
  );

  const toggleAlarm = useCallback(
    (id: string) => {
      // Capture the computed alarm outside setAlarms so scheduling and Supabase
      // updates run after the state update, not inside the updater.
      let alarmToSchedule: Alarm | undefined;
      setAlarms((prev) => {
        const updated = prev.map((a) =>
          a.id === id ? { ...a, enabled: !a.enabled } : a
        );
        alarmToSchedule = updated.find((a) => a.id === id);
        return updated;
      });
      if (alarmToSchedule) {
        scheduleOnPlatform(alarmToSchedule).catch(() => {});
        if (userId) {
          Promise.resolve(
            supabase
              .from("alarms")
              .update({ enabled: alarmToSchedule.enabled })
              .eq("id", id)
              .eq("user_id", userId)
          ).catch(() => {});
        }
      }
    },
    [userId, scheduleOnPlatform]
  );

  const getNextAlarm = useCallback((): Alarm | null => {
    const enabled = alarms.filter((a) => a.enabled);
    if (!enabled.length) return null;
    const now = new Date();
    const todayDay = now.getDay();
    let earliest: Alarm | null = null;
    let earliestMinutes = Infinity;
    for (const alarm of enabled) {
      const alarmHour24 = alarm.isPM
        ? alarm.hour === 12
          ? 12
          : alarm.hour + 12
        : alarm.hour === 12
        ? 0
        : alarm.hour;
      const alarmTotalMins = alarmHour24 * 60 + alarm.minute;
      const nowMins = now.getHours() * 60 + now.getMinutes();
      for (let d = 0; d < 7; d++) {
        const dayIndex = (todayDay + d) % 7;
        if (!alarm.days[dayIndex] && alarm.days.some(Boolean)) continue;
        if (!alarm.days.some(Boolean)) {
          const diff =
            d === 0
              ? alarmTotalMins > nowMins
                ? alarmTotalMins - nowMins
                : 1440 - nowMins + alarmTotalMins
              : d * 1440 + alarmTotalMins;
          if (diff < earliestMinutes) {
            earliestMinutes = diff;
            earliest = alarm;
          }
          break;
        }
        const diff =
          d === 0 && alarmTotalMins > nowMins
            ? alarmTotalMins - nowMins
            : d * 1440 + alarmTotalMins - (d === 0 ? nowMins : 0);
        if (diff < earliestMinutes) {
          earliestMinutes = diff;
          earliest = alarm;
        }
        break;
      }
    }
    return earliest;
  }, [alarms]);

  return (
    <AlarmContext.Provider
      value={{
        alarms,
        addAlarm,
        updateAlarm,
        deleteAlarm,
        toggleAlarm,
        getNextAlarm,
        streak,
        longestStreak,
        incrementStreak,
        isLoaded: loaded,
        alarmKitDenied,
        clearAlarmKitDenied: () => setAlarmKitDenied(false),
        alarmKitConfigureError,
        clearAlarmKitConfigureError: () => setAlarmKitConfigureError(false),
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarms() {
  return useContext(AlarmContext);
}

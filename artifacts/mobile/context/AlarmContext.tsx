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
/** Written for both guest and authenticated users so the background task can read it. */
export const ALARM_CACHE_KEY = "@bible_wake_alarms_cache";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const SAMPLE_ALARMS: Alarm[] = [
  {
    id: "sample1",
    hour: 11,
    minute: 43,
    isPM: false,
    days: [false, true, true, true, false, false, false],
    name: "Morning Alarm",
    verseRef: "John 3:16",
    verseText:
      "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.",
    enabled: true,
    alarmType: "verse",
    scheduleType: "scheduled",
    wakeUpCheck: false,
  },
];

interface AlarmContextType {
  alarms: Alarm[];
  addAlarm: (alarm: Omit<Alarm, "id">) => void;
  updateAlarm: (id: string, updates: Partial<Alarm>) => void;
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
}

const AlarmContext = createContext<AlarmContextType>({
  alarms: [],
  addAlarm: () => {},
  updateAlarm: () => {},
  deleteAlarm: () => {},
  toggleAlarm: () => {},
  getNextAlarm: () => null,
  streak: 1,
  longestStreak: 1,
  incrementStreak: (_recitalSuccess?: boolean) => {},
  isLoaded: false,
  alarmKitDenied: false,
  clearAlarmKitDenied: () => {},
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
  const [userId, setUserId] = useState<string | null>(null);
  const [alarmKitDenied, setAlarmKitDenied] = useState(false);

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
              setAlarms(raw ? JSON.parse(raw) : SAMPLE_ALARMS);
            });
          }
          setAlarms(data.length > 0 ? data.map(rowToAlarm) : SAMPLE_ALARMS);
        })
        .catch(() => {
          AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
            setAlarms(raw ? JSON.parse(raw) : SAMPLE_ALARMS);
          });
        })
        .finally(() => setLoaded(true));

      // Load streak from Supabase
      Promise.resolve(
        supabase
          .from("streaks")
          .select("current_streak, longest_streak")
          .eq("user_id", userId)
          .single()
      )
        .then(({ data }) => {
          if (data) {
            setStreak(data.current_streak ?? 0);
            setLongestStreak(data.longest_streak ?? 0);
          }
        })
        .catch(() => {});
    } else {
      // Guest mode — AsyncStorage
      Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(STREAK_KEY),
        AsyncStorage.getItem(LONGEST_STREAK_KEY),
      ])
        .then(([data, streakVal, longestVal]) => {
          setAlarms(data ? JSON.parse(data) : SAMPLE_ALARMS);
          if (streakVal !== null) setStreak(parseInt(streakVal, 10));
          if (longestVal !== null) setLongestStreak(parseInt(longestVal, 10));
        })
        .catch(() => setAlarms(SAMPLE_ALARMS))
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
                last_wake_date: new Date().toISOString().split("T")[0],
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
  }, [userId]);

  // ── Unified platform scheduling (inside provider — can access setAlarmKitDenied) ──
  // Used by all user-initiated scheduling paths: addAlarm, updateAlarm, toggleAlarm.
  // On iOS, calls scheduleAlarmKit (which requests authorization on first call) and
  // surfaces alarmKitDenied=true when the user has denied Alarms permission.
  const scheduleOnPlatform = useCallback(async (alarm: Alarm): Promise<void> => {
    if (Platform.OS === "ios") {
      const result: AlarmKitScheduleResult = await scheduleAlarmKit(alarm).catch(
        () => "error" as AlarmKitScheduleResult
      );
      if (result === "denied") setAlarmKitDenied(true);
    } else {
      scheduleAlarmNotifications(alarm).catch(() => {});
    }
  }, []);

  // ── CRUD operations ───────────────────────────────────────────────────────────

  const addAlarm = useCallback(
    async (alarm: Omit<Alarm, "id">) => {
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
          return;
        }
      }

      // Guest mode or Supabase error — local only
      newAlarm = { ...alarm, id: generateId() };
      setAlarms((prev) => [...prev, newAlarm]);
      await scheduleOnPlatform(newAlarm);
    },
    [userId, scheduleOnPlatform]
  );

  const updateAlarm = useCallback(
    (id: string, updates: Partial<Alarm>) => {
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
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarms() {
  return useContext(AlarmContext);
}

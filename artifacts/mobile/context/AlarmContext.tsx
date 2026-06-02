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
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { pickRandomVerseBackground } from "@/lib/wakeHistory";

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
  incrementStreak: () => void;
  /** Whether alarms are loaded from their source (Supabase or AsyncStorage) */
  isLoaded: boolean;
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
  incrementStreak: () => {},
  isLoaded: false,
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

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);

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

  // ── Streak (local + Supabase) ─────────────────────────────────────────────────
  const incrementStreak = useCallback(() => {
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

  // ── CRUD operations ───────────────────────────────────────────────────────────

  const addAlarm = useCallback(
    async (alarm: Omit<Alarm, "id">) => {
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
          setAlarms((prev) => [...prev, rowToAlarm(data)]);
          return;
        }
      }

      // Guest mode or Supabase error — local only
      setAlarms((prev) => [...prev, { ...alarm, id: generateId() }]);
    },
    [userId]
  );

  const updateAlarm = useCallback(
    (id: string, updates: Partial<Alarm>) => {
      setAlarms((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
      );

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
    [userId]
  );

  const deleteAlarm = useCallback(
    (id: string) => {
      setAlarms((prev) => prev.filter((a) => a.id !== id));

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
      setAlarms((prev) => {
        const updated = prev.map((a) =>
          a.id === id ? { ...a, enabled: !a.enabled } : a
        );

        if (userId) {
          const alarm = updated.find((a) => a.id === id);
          if (alarm) {
            Promise.resolve(
              supabase
                .from("alarms")
                .update({ enabled: alarm.enabled })
                .eq("id", id)
                .eq("user_id", userId)
            ).catch(() => {});
          }
        }

        return updated;
      });
    },
    [userId]
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
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarms() {
  return useContext(AlarmContext);
}

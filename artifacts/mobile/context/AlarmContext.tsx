import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
}

const STORAGE_KEY = "@bible_wake_alarms";
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
});

export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [longestStreak, setLongestStreak] = useState(1);

  const streak = 1;

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (data) {
          setAlarms(JSON.parse(data));
        } else {
          setAlarms(SAMPLE_ALARMS);
        }
      })
      .catch(() => setAlarms(SAMPLE_ALARMS))
      .finally(() => setLoaded(true));

    AsyncStorage.getItem(LONGEST_STREAK_KEY)
      .then((val) => {
        if (val !== null) {
          setLongestStreak(parseInt(val, 10));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarms)).catch(
        () => {}
      );
    }
  }, [alarms, loaded]);

  useEffect(() => {
    if (streak > longestStreak) {
      setLongestStreak(streak);
      AsyncStorage.setItem(LONGEST_STREAK_KEY, String(streak)).catch(() => {});
    }
  }, [streak, longestStreak]);

  const addAlarm = useCallback((alarm: Omit<Alarm, "id">) => {
    setAlarms((prev) => [...prev, { ...alarm, id: generateId() }]);
  }, []);

  const updateAlarm = useCallback((id: string, updates: Partial<Alarm>) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  }, []);

  const deleteAlarm = useCallback((id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleAlarm = useCallback((id: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  }, []);

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
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarms() {
  return useContext(AlarmContext);
}

/**
 * alarmScheduler — schedules and cancels local notifications for alarms.
 *
 * Each alarm can fire on multiple days of the week, so up to 7 weekly-repeating
 * notifications are created per alarm. One-time alarms (no days selected) get a
 * single DATE trigger for the next occurrence of that time.
 *
 * Notification IDs are persisted to AsyncStorage so they survive app restarts
 * and can be reliably cancelled.
 *
 * Android specifics:
 *  - A max-importance "alarm" channel is created once; max importance is required
 *    for USE_FULL_SCREEN_INTENT to work (lock-screen alarm overlay).
 *  - All notifications are posted to that channel so they bypass Doze mode and
 *    appear as full-screen intents on the lock screen.
 *  - WAKE_LOCK (declared in app.json) is required so the OS grants the CPU
 *    wakelock that expo-av acquires internally via staysActiveInBackground; see
 *    alarm-ringing.tsx where Audio.setAudioModeAsync actually activates this.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { Alarm } from "@/context/AlarmContext";

const ANDROID_ALARM_CHANNEL_ID = "bible_wake_alarms";

/**
 * Create (or no-op if already exists) a high-importance Android notification
 * channel that enables full-screen intents and bypasses Doze.
 * Must be called before scheduling any notifications on Android.
 */
export async function ensureAndroidAlarmChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_ALARM_CHANNEL_ID, {
    name: "Alarms",
    description: "Bible Wake morning alarms",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 500, 200, 500],
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility:
      Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
}

const NOTIF_IDS_KEY = "@bible_wake_notif_ids";

async function loadNotifIds(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_IDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveNotifIds(map: Record<string, string[]>): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIF_IDS_KEY, JSON.stringify(map));
  } catch {}
}

/** Cancel all scheduled notifications for a given alarm ID. */
export async function cancelAlarmNotifications(alarmId: string): Promise<void> {
  if (Platform.OS === "web") return;
  const map = await loadNotifIds();
  const ids = map[alarmId] ?? [];
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
  delete map[alarmId];
  await saveNotifIds(map);
}

/**
 * Schedule (or reschedule) local notifications for an alarm.
 * Any previously scheduled notifications for this alarm are cancelled first.
 * Does nothing if the alarm is disabled.
 */
export async function scheduleAlarmNotifications(alarm: Alarm): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelAlarmNotifications(alarm.id);
  if (!alarm.enabled) return;

  const hour24 = alarm.isPM
    ? alarm.hour === 12
      ? 12
      : alarm.hour + 12
    : alarm.hour === 12
    ? 0
    : alarm.hour;

  // Ensure the Android alarm channel exists before scheduling.
  await ensureAndroidAlarmChannel();

  const content: Notifications.NotificationContentInput = {
    title: alarm.name || "Bible Wake",
    body: alarm.verseRef
      ? `Time to recite: ${alarm.verseRef}`
      : "Time to wake up!",
    data: {
      alarmId: alarm.id,
      type: alarm.wakeUpCheck ? "wakeup" : "verse",
    },
    // "default" plays the standard notification sound. "timeSensitive" interrupts
    // most Focus modes (Sleep, Work, etc.) without special Apple entitlements.
    sound: "default",
    interruptionLevel: "timeSensitive",
    // Android: post to the max-importance alarm channel so the notification is
    // eligible for full-screen intent (lock-screen alarm overlay) and bypasses Doze.
    ...(Platform.OS === "android" && {
      categoryIdentifier: "alarm",
      channelId: ANDROID_ALARM_CHANNEL_ID,
    }),
  };

  const scheduledIds: string[] = [];
  const hasAnyDay = alarm.days.some(Boolean);

  if (!hasAnyDay) {
    // One-time: fire at the next occurrence of this time
    const now = new Date();
    const target = new Date();
    target.setHours(hour24, alarm.minute, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target,
      },
    });
    scheduledIds.push(id);
  } else {
    // Weekly: one notification per enabled day
    // JS getDay() uses 0=Sunday…6=Saturday
    // expo-notifications weekday uses 1=Sunday…7=Saturday
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      if (!alarm.days[dayIndex]) continue;
      const weekday = dayIndex + 1;
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: hour24,
          minute: alarm.minute,
        },
      });
      scheduledIds.push(id);
    }
  }

  const map = await loadNotifIds();
  map[alarm.id] = scheduledIds;
  await saveNotifIds(map);
}

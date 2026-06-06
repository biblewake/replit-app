/**
 * backgroundAlarmCheck — registers a background fetch task that verifies
 * all enabled alarms still have scheduled notifications. This handles the
 * edge case where the OS drops notifications after the app is killed for
 * an extended period.
 *
 * NOTE: expo-background-fetch and expo-task-manager must be imported at
 * module level for TaskManager.defineTask to register before any JS
 * suspension. Import this file at app startup (e.g. in _layout.tsx) so
 * the task definition is always present.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { Alarm, ALARM_CACHE_KEY } from "@/context/AlarmContext";
import { scheduleAlarmNotifications } from "./alarmScheduler";

export const BACKGROUND_ALARM_TASK = "BACKGROUND_ALARM_CHECK";

TaskManager.defineTask(BACKGROUND_ALARM_TASK, async () => {
  try {
    // ALARM_CACHE_KEY is written for both guest and authenticated users.
    // This avoids the stale-data problem of reading the guest-only STORAGE_KEY.
    const raw = await AsyncStorage.getItem(ALARM_CACHE_KEY);
    const alarms: Alarm[] = raw ? JSON.parse(raw) : [];
    await Promise.all(
      alarms
        .filter((a) => a.enabled)
        .map((a) => scheduleAlarmNotifications(a))
    );
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/** Register the background alarm check task. Safe to call multiple times. */
export async function registerBackgroundAlarmTask(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_ALARM_TASK
    );
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_ALARM_TASK, {
        minimumInterval: 60 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch {
    // Background fetch is best-effort; silently degrade
  }
}

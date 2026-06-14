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
 *
 * iOS post-reboot strategy:
 * iOS cancels all scheduled local notifications on device reboot and offers
 * no BOOT_COMPLETED equivalent. Instead we rely on two layers:
 *  1. BGAppRefreshTask — expo-background-fetch registers this automatically
 *     when UIBackgroundModes: fetch is present in app.json. iOS fires it
 *     opportunistically, which eventually catches a post-reboot state.
 *  2. AppState "active" listener (wired in _layout.tsx) — calls
 *     rescheduleAllAlarms() on every foreground transition, so the first
 *     time the user opens the app after a reboot the alarms are immediately
 *     restored. This is the primary guarantee on iOS.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { Alarm, ALARM_CACHE_KEY } from "@/context/AlarmContext";
import { scheduleAlarmNotifications } from "./alarmScheduler";
import { scheduleAlarmKit } from "./alarmKitScheduler";

export const BACKGROUND_ALARM_TASK = "BACKGROUND_ALARM_CHECK";

/**
 * Re-schedule notifications for every enabled alarm stored in AsyncStorage.
 * Called from both the background task and the foreground AppState listener
 * (iOS) so alarms are restored after an OS-level notification purge (e.g.
 * device reboot).
 */
export async function rescheduleAllAlarms(): Promise<void> {
  const raw = await AsyncStorage.getItem(ALARM_CACHE_KEY);
  const alarms: Alarm[] = raw ? JSON.parse(raw) : [];
  // iOS 26+: reschedule via AlarmKit with skipAuth=true so the iOS Alarms
  // permission dialog is never triggered outside an explicit user action.
  // Android: reschedule via expo-notifications (no auth concept).
  if (Platform.OS === "ios") {
    await Promise.all(
      alarms
        .filter((a) => a.enabled)
        .map((a) => scheduleAlarmKit(a, { skipAuth: true }))
    );
  } else {
    await Promise.all(
      alarms
        .filter((a) => a.enabled)
        .map((a) => scheduleAlarmNotifications(a))
    );
  }
}

TaskManager.defineTask(BACKGROUND_ALARM_TASK, async () => {
  try {
    await rescheduleAllAlarms();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background alarm check task. Safe to call multiple times.
 *
 * The outer synchronous try-catch guards against any native void-method throw
 * that occurs before the first `await` (i.e. before the async state machine
 * hands control back to the caller). Under New Architecture on iOS 26, such a
 * throw on a background GCD thread would otherwise cause a SIGSEGV via
 * convertNSExceptionToJSError. The inner try-catch is the existing best-effort
 * guard around the await chain.
 */
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
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_ALARM_TASK, {
          minimumInterval: 60 * 60,
          stopOnTerminate: false,
          startOnBoot: true,
        });
      } catch {
        // registerTaskAsync is a void native method — swallow any throw so a
        // background-GCD exception cannot propagate to the New Arch crash path.
      }
    }
  } catch {
    // Background fetch is best-effort; silently degrade
  }
}

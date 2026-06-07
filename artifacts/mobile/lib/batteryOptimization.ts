/**
 * batteryOptimization — helpers for requesting Android battery-optimisation
 * exemption.
 *
 * Many OEM Androids (Samsung, Xiaomi, OnePlus, Huawei) aggressively kill
 * background processes — including AlarmManager entries — when the user swipes
 * an app away from the recent-apps list.  Requesting battery-optimisation
 * exemption ("Unrestricted" in Battery settings) tells the OS to preserve our
 * scheduled alarms even after the app is removed from recents.
 *
 * Two intents are tried in order:
 *  1. ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS — shows an OS dialog
 *     requesting exemption specifically for Bible Wake (most direct).
 *  2. ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS — opens the battery
 *     optimisation list so the user can find Bible Wake manually (fallback for
 *     OEMs that block the direct request intent).
 */

import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

const PACKAGE_NAME = "com.tinochiwara.biblewake";

/**
 * Open the system battery-optimisation exemption UI for Bible Wake.
 *
 * On most stock Android / Pixel devices this shows an instant OS dialog:
 *   "Allow <app> to always run in the background?"  [Deny] [Allow]
 *
 * On OEMs that block the direct intent (some MIUI builds) it falls back to
 * the general "Battery optimisation" list where the user can locate Bible Wake
 * and set it to "Don't optimise" / "Unrestricted".
 *
 * No-op on iOS and web.
 */
export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await IntentLauncher.startActivityAsync(
      "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      { data: `package:${PACKAGE_NAME}` }
    );
  } catch {
    try {
      await IntentLauncher.startActivityAsync(
        "android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS"
      );
    } catch {}
  }
}

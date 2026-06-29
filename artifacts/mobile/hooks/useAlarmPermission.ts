import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, PermissionsAndroid, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncAlarmKitAuthIfDenied } from "@/lib/alarmKitScheduler";

const HAS_PROMPTED_ALARM_KEY = "@bible_wake_has_prompted_alarm";

export function useAlarmPermission(): {
  hasPermission: boolean;
  hasExactAlarmPermission: boolean;
  alarmKitAuthorized: boolean;
} {
  const [hasPermission, setHasPermission] = useState(true);
  const [hasExactAlarmPermission, setHasExactAlarmPermission] = useState(true);
  const [alarmKitAuthorized, setAlarmKitAuthorized] = useState(true);
  const isChecking = useRef(false);

  const checkPermission = async () => {
    if (isChecking.current) return;
    isChecking.current = true;
    try {
      try {
        const result = await Notifications.getPermissionsAsync();
        const status = (result as unknown as { granted?: boolean }).granted;
        setHasPermission(status !== false);
      } catch {
        setHasPermission(true);
      }

      if (Platform.OS === "android" && Number(Platform.Version) >= 31) {
        try {
          const granted = await PermissionsAndroid.check(
            "android.permission.SCHEDULE_EXACT_ALARM" as Parameters<typeof PermissionsAndroid.check>[0]
          );
          setHasExactAlarmPermission(granted);
        } catch {
          setHasExactAlarmPermission(true);
        }
      }

      if (Platform.OS === "ios") {
        // Only check AlarmKit status if the user has already passed onboarding
        // step 25 (alarm permission prompt). Before that point, skip entirely —
        // calling syncAlarmKitAuthIfDenied() before the flag is set would trigger
        // a system dialog out of context, violating Apple's guidelines.
        let hasPrompted = false;
        try {
          const val = await AsyncStorage.getItem(HAS_PROMPTED_ALARM_KEY);
          hasPrompted = val === "true";
        } catch {
          hasPrompted = false;
        }

        if (!hasPrompted) {
          // Pre-onboarding: treat as authorized — no dialog should appear yet.
          setAlarmKitAuthorized(true);
        } else {
          // Post-onboarding: sync the live status. requestAuthorization() is safe
          // here because the user already made a decision (cached denied flag is
          // true), so iOS will NOT re-show the system prompt.
          const denied = await syncAlarmKitAuthIfDenied();
          setAlarmKitAuthorized(!denied);
        }
      }
    } finally {
      isChecking.current = false;
    }
  };

  useEffect(() => {
    checkPermission();

    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        checkPermission();
      }
    });

    return () => sub.remove();
  }, []);

  return { hasPermission, hasExactAlarmPermission, alarmKitAuthorized };
}

import { useEffect, useState } from "react";
import { AppState, AppStateStatus, PermissionsAndroid, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { getAlarmKitAuthDenied } from "@/lib/alarmKitScheduler";

export function useAlarmPermission(): {
  hasPermission: boolean;
  hasExactAlarmPermission: boolean;
  alarmKitAuthorized: boolean;
} {
  const [hasPermission, setHasPermission] = useState(true);
  const [hasExactAlarmPermission, setHasExactAlarmPermission] = useState(true);
  const [alarmKitAuthorized, setAlarmKitAuthorized] = useState(true);

  const checkPermission = async () => {
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
      // Read the persisted denied flag written by scheduleAlarmKit — never
      // calls requestAuthorization() so this path never triggers the system
      // prompt during passive foreground checks.
      const denied = await getAlarmKitAuthDenied();
      setAlarmKitAuthorized(!denied);
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

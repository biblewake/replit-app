import { useEffect, useState } from "react";
import { AppState, AppStateStatus, PermissionsAndroid, Platform } from "react-native";
import * as Notifications from "expo-notifications";

export function useAlarmPermission(): {
  hasPermission: boolean;
  hasExactAlarmPermission: boolean;
} {
  const [hasPermission, setHasPermission] = useState(true);
  const [hasExactAlarmPermission, setHasExactAlarmPermission] = useState(true);

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

  return { hasPermission, hasExactAlarmPermission };
}

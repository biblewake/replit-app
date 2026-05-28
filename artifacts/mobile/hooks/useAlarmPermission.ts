import { useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";

export function useAlarmPermission(): { hasPermission: boolean } {
  const [hasPermission, setHasPermission] = useState(true);

  const checkPermission = async () => {
    try {
      const result = await Notifications.getPermissionsAsync();
      const status = (result as unknown as { granted?: boolean }).granted;
      setHasPermission(status !== false);
    } catch {
      setHasPermission(true);
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

  return { hasPermission };
}

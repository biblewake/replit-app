import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const REVIEW_PROMPTED_KEY = "@bible_wake_review_prompted";
const FIRST_ALARM_DISMISSED_KEY = "@bible_wake_first_alarm_dismissed";

async function requestReviewIfAvailable(): Promise<void> {
  const available = await StoreReview.isAvailableAsync();
  if (available) {
    await StoreReview.requestReview();
  }
}

export function useRatingRequest() {
  const promptOnOnboardingComplete = async (): Promise<void> => {
    try {
      const already = await AsyncStorage.getItem(REVIEW_PROMPTED_KEY);
      if (already) return;

      await requestReviewIfAvailable();
      await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, "1");
    } catch {
      // never let rating errors surface to the user
    }
  };

  const promptOnFirstAlarmDismissal = async (): Promise<void> => {
    try {
      const already = await AsyncStorage.getItem(REVIEW_PROMPTED_KEY);
      if (already) return;

      const firstDismissed = await AsyncStorage.getItem(
        FIRST_ALARM_DISMISSED_KEY
      );
      if (firstDismissed) return;

      await AsyncStorage.setItem(FIRST_ALARM_DISMISSED_KEY, "1");
      await requestReviewIfAvailable();
      await AsyncStorage.setItem(REVIEW_PROMPTED_KEY, "1");
    } catch {
      // never let rating errors surface to the user
    }
  };

  return { promptOnOnboardingComplete, promptOnFirstAlarmDismissal };
}

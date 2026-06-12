import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus, Appearance, Platform, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AlarmProvider } from "@/context/AlarmContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ensureAndroidAlarmChannel } from "@/lib/alarmScheduler";
import {
  registerBackgroundAlarmTask,
  rescheduleAllAlarms,
} from "@/lib/backgroundAlarmCheck";
import {
  SubscriptionProvider,
  useSubscription,
} from "@/lib/revenuecat";

// ── Global notification handler ───────────────────────────────────────────────
// Must be set before any notification fires. Controls foreground presentation.
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Register the background alarm check task at module load time so the task
// definition is present before any JS suspension (required by TaskManager).
if (Platform.OS !== "web") {
  registerBackgroundAlarmTask().catch(() => {});
}

// Create (or verify) the max-importance Android notification channel that
// enables USE_FULL_SCREEN_INTENT and lock-screen alarm overlays. No-ops on iOS/web.
if (Platform.OS === "android") {
  ensureAndroidAlarmChannel().catch(() => {});
}

SplashScreen.preventAutoHideAsync();

// ── Global JS error handler ───────────────────────────────────────────────────
// Catches any unhandled JS exception (including void-fired async rejections)
// and swallows them instead of forwarding to React Native's default fatal
// handler. The default handler calls RCTFatal, which aborts the process with
// SIGABRT — the crash seen on every TestFlight build. The native trace only
// ever shows the reporting path (RCTExceptionsManager → RCTFatal), never the
// real JS error.
//
// A shipped app must degrade gracefully, never hard-crash on launch (App
// Review rejects launch crashes outright). By NOT forwarding to the default
// handler the app stays alive.
//
// This is set last at module top level so nothing else can overwrite it.
if (Platform.OS !== "web" && typeof ErrorUtils !== "undefined") {
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    if (__DEV__) {
      console.error("[GlobalHandler]", isFatal ? "FATAL" : "non-fatal", error);
    }
    // Intentionally swallow — never call the default handler (RCTFatal → SIGABRT).
  });
}

const queryClient = new QueryClient();

/**
 * Expo Go SDK 53 forces New Architecture on, which crashes the gesture-handler
 * TurboModule at import time when newArchEnabled is false in app.json. Lazy-
 * require GestureHandlerRootView so the module is never evaluated in Expo Go,
 * falling back to a plain View (gestures still work via JS-driven fallbacks).
 */
const isExpoGo = Constants.executionEnvironment === "storeClient";

/**
 * Expo Go SDK 53 forces New Architecture on, which crashes the gesture-handler
 * TurboModule at import time when newArchEnabled is false in app.json. Lazy-
 * require GestureHandlerRootView so the module is never evaluated in Expo Go,
 * falling back to a plain View (gestures still work via JS-driven fallbacks).
 */
function GestureWrapper({ children }: { children: React.ReactNode }) {
  if (isExpoGo || Platform.OS === "web") {
    return <View style={{ flex: 1 }}>{children}</View>;
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GestureHandlerRootView } = require("react-native-gesture-handler") as typeof import("react-native-gesture-handler");
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>;
}


function RootLayoutNav() {
  const { onboardingComplete } = useAuth();
  const { isSubscribed, isLoading: subscriptionLoading } = useSubscription();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (onboardingComplete === null) return; // still resolving the flag

    const inOnboarding = segments[0] === "onboarding";
    const inPaywall = segments[0] === "paywall";

    // DEV: skip onboarding + paywall gates during development
    const DEV_SKIP_GATES = __DEV__;
    if (DEV_SKIP_GATES) {
      if (inOnboarding || inPaywall) router.replace("/(tabs)");
      return;
    }

    if (!onboardingComplete) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }

    // Onboarding complete — check subscription status.
    // Wait for the subscription query to finish loading before deciding.
    if (subscriptionLoading) return;

    if (!isSubscribed) {
      if (!inPaywall) router.replace("/paywall");
      return;
    }

    // Subscribed — navigate to tabs if sitting on onboarding or paywall.
    if (inOnboarding || inPaywall) {
      router.replace("/(tabs)");
    }
  }, [onboardingComplete, isSubscribed, subscriptionLoading, segments, router]);

  // ── iOS: reschedule alarms on every foreground transition ────────────────
  // iOS cancels all local notifications on device reboot and has no
  // BOOT_COMPLETED equivalent. Rescheduling whenever the app becomes active
  // ensures alarms are restored the first time the user opens the app after a
  // reboot (or after any other OS-level notification purge).
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    if (Platform.OS !== "ios") return;

    // Reschedule immediately on cold launch in case the device was rebooted
    // while the app was not running.
    rescheduleAllAlarms().catch(() => {});

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;
        // Only act when transitioning into active from background/inactive.
        if (
          nextState === "active" &&
          (prev === "background" || prev === "inactive")
        ) {
          rescheduleAllAlarms().catch(() => {});
        }
      }
    );
    return () => subscription.remove();
  }, []); // run once on mount

  // ── Cold-launch: app opened by tapping an alarm notification ─────────────
  useEffect(() => {
    if (Platform.OS === "web") return;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as {
          alarmId?: string;
          type?: string;
        };
        if (data?.alarmId) {
          router.push({
            pathname: "/alarm-ringing",
            params: {
              alarmId: data.alarmId,
              type: data.type ?? "verse",
            },
          });
        }
      })
      .catch(() => {});
  }, []); // run once on mount

  // ── Foreground / background tap listener ─────────────────────────────────
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          alarmId?: string;
          type?: string;
        };
        if (data?.alarmId) {
          router.push({
            pathname: "/alarm-ringing",
            params: {
              alarmId: data.alarmId,
              type: data.type ?? "verse",
            },
          });
        }
      }
    );
    return () => subscription.remove();
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false, animation: "fade" }}
      />
      <Stack.Screen
        name="paywall"
        options={{ headerShown: false, animation: "fade" }}
      />
      <Stack.Screen
        name="alarm-ringing"
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "fade",
        }}
      />
    </Stack>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== "web") {
      Appearance.setColorScheme?.("light");
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <GestureWrapper>
              <AuthProvider>
                <SubscriptionProvider>
                  <AlarmProvider>
                    <RootLayoutNav />
                  </AlarmProvider>
                </SubscriptionProvider>
              </AuthProvider>
            </GestureWrapper>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default RootLayout;

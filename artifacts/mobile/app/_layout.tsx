import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, AppState, AppStateStatus, Appearance, Platform, View } from "react-native";
import { supabase } from "@/lib/supabase";
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
  getLaunchPayload,
  initAlarmKit,
} from "@/lib/alarmKitScheduler";
import {
  initializeRevenueCat,
  SubscriptionProvider,
  useSubscription,
} from "@/lib/revenuecat";

// ── Module-level: only TaskManager.defineTask calls are safe here ─────────────
// All other native void-method calls are deferred to useEffect in RootLayout.
// Under New Architecture, a void TurboModule method that throws on a background
// GCD thread causes a SIGSEGV because convertNSExceptionToJSError tries to write
// into the Hermes heap off the JS thread. Deferring to useEffect ensures the
// React runtime is fully up before any native calls are made.

try {
  SplashScreen.preventAutoHideAsync();
} catch {
  // Swallow — SplashScreen is best-effort; app must not crash if it fails
}

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

// ── AlarmKit stale-denied migration ──────────────────────────────────────────
// Prior builds called configure() before requestAuthorization(), which could
// leave the native module in a bad state and cause requestAuthorization() to
// throw silently. That exception was caught and returned as "denied", so
// AK_AUTH_DENIED_KEY was written even though the dialog never appeared.
// On first launch of a fixed build, clear any stale "denied" flag so the
// dialog can be shown properly.

const AK_MIGRATION_V1_KEY = "@bible_wake_ak_migration_v1";

async function clearStaleAlarmKitDenied() {
  try {
    const done = await AsyncStorage.getItem(AK_MIGRATION_V1_KEY);
    if (done) return;
    await AsyncStorage.removeItem("@bible_wake_ak_auth_denied");
    await AsyncStorage.setItem(AK_MIGRATION_V1_KEY, "1");
  } catch {
    // best-effort
  }
}

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
  const { onboardingComplete, isAnonymous, user, isGuest } = useAuth();
  const { isSubscribed, isLoading: subscriptionLoading } = useSubscription();
  const segments = useSegments();
  const router = useRouter();

  // ── Query cache lifecycle: clear on sign-out, invalidate on sign-in ─────────
  // prevUserIdRef starts as `undefined` (uninitialized sentinel) so the first
  // render is skipped and we only react to actual transitions.
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const currUserId = user?.id ?? null;
    if (prevUserIdRef.current === undefined) {
      // First render — record initial value, no action needed.
      prevUserIdRef.current = currUserId;
      return;
    }
    if (prevUserIdRef.current !== currUserId) {
      if (!currUserId) {
        // User signed out — wipe ALL cached query data so the next account
        // sees no stale streak, alarm, or profile data from the previous session.
        queryClient.clear();
      } else {
        // User signed in (or switched accounts) — force an immediate refetch of
        // all active queries so tabs load data on first render without waiting
        // for the staleTime to expire.
        void queryClient.invalidateQueries();
      }
      prevUserIdRef.current = currUserId;
    }
  }, [user]);

  useEffect(() => {
    if (onboardingComplete === null) return; // still resolving the flag

    const inOnboarding = segments[0] === "onboarding";
    const inPaywall = segments[0] === "paywall";

    // DEV: set to true to skip onboarding + paywall and jump straight to home
    const DEV_SKIP_GATES = false;
    if (DEV_SKIP_GATES) {
      if (inOnboarding || inPaywall) router.replace("/(tabs)");
      return;
    }

    // DEV: set to true to land directly on the onboarding paywall (step 30)
    const DEV_START_AT_PAYWALL = false;
    if (DEV_START_AT_PAYWALL) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }

    if (!onboardingComplete) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }

    // Onboarding complete but no session — user just signed out.
    // Send them to the sign-in step (step 29) of onboarding instead of
    // restarting the full quiz from step 0.
    if (!user && !isGuest) {
      if (!inOnboarding) router.replace("/onboarding?step=29");
      return;
    }

    // Onboarding complete — block anonymous (guest) users from the main app.
    // Anonymous Supabase sessions and the in-memory guest flag both count here.
    // Redirect to onboarding so the user can sign in with Google or Apple.
    if (isAnonymous) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }

    // Onboarding complete — check subscription status.
    // Wait for the subscription query to finish loading before deciding.
    if (subscriptionLoading) return;

    if (!isSubscribed) {
      // Send to onboarding (which jumps to the paywall at step 30) unless the
      // user is already inside onboarding or on the standalone /paywall screen.
      // The standalone paywall must remain reachable from Settings and other
      // surfaces, so inPaywall is treated as a safe landing spot too.
      if (!inOnboarding && !inPaywall) router.replace("/onboarding");
      return;
    }

    // Subscribed — navigate to tabs if sitting on onboarding or paywall.
    if (inOnboarding || inPaywall) {
      router.replace("/(tabs)");
    }
  }, [onboardingComplete, isAnonymous, user, isGuest, isSubscribed, subscriptionLoading, segments, router]);

  // ── iOS: foreground handler — reschedule alarms + check AlarmKit payload ──
  // Combined into one AppState listener to handle both cold launch and warm
  // foreground events (e.g. user taps Dismiss/Snooze from the system alarm UI
  // while the app is already in the background).
  //
  // getLaunchPayload() is idempotent for the current launch event: AlarmKit
  // sets it when foregrounding the app; it returns null on ordinary app-switches
  // unrelated to an alarm action.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    // expo-alarm-kit is a custom native module — not available in Expo Go.
    // Calling require("expo-alarm-kit") in Expo Go fires a [GlobalHandler] FATAL
    // log even though the try/catch in getAk() handles the error, because Expo
    // Go's require machinery also notifies ErrorUtils before the catch runs.
    if (isExpoGo) return;

    initAlarmKit().catch((e) => {
      if (__DEV__) console.warn("[AlarmKit] init failed:", e);
    });

    const handleForeground = () => {
      // Reschedule — guards against OS notification purge after reboot.
      rescheduleAllAlarms().catch(() => {});

      // Check whether AlarmKit foregrounded the app (dismiss/snooze action).
      // payload.alarmId is the same id passed to scheduleAlarm/scheduleRepeatingAlarm
      // so no reverse-lookup is needed.
      const payload = getLaunchPayload();
      if (!payload?.alarmId) return;
      // Omit 'type' so alarm-ringing.tsx derives it from alarm.wakeUpCheck.
      router.push({
        pathname: "/alarm-ringing",
        params: { alarmId: payload.alarmId },
      });
    };

    // Run immediately on cold launch.
    handleForeground();

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;
        if (
          nextState === "active" &&
          (prev === "background" || prev === "inactive")
        ) {
          handleForeground();
        }
      }
    );
    return () => subscription.remove();
  }, [router]); // router is stable but listed to satisfy exhaustive-deps

  // ── Cold-launch: app opened by tapping an alarm notification (Android) ────
  useEffect(() => {
    if (Platform.OS !== "android") return;
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

  // ── Foreground / background notification tap listener ─────────────────────
  // Android: handles alarm notifications.
  // iOS: handles non-alarm notifications (verse-of-the-day, etc.) only —
  //      AlarmKit alarms are handled via getLaunchPayload() above.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as {
          alarmId?: string;
          type?: string;
        };
        // On iOS, alarm navigation is handled by AlarmKit payload; skip here.
        if (Platform.OS === "ios" && data?.alarmId) return;
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

  // Block rendering while initial auth/onboarding state is being read from
  // AsyncStorage. This is a very brief window (< 100 ms) before the persisted
  // flag loads — returning null here avoids a one-frame flash of stale content.
  // NOTE: do NOT return null for any state that depends on navigation redirects
  // (onboardingComplete===false, isAnonymous, !isSubscribed). Returning null
  // unmounts the Stack navigator, which prevents router.replace() from rendering
  // its destination — the permanent black screen bug. Let the useEffect handle
  // all post-load redirects while the Stack stays mounted.
  if (onboardingComplete === null) return null;
  // Subscription state is still loading — show a neutral spinner so we never
  // render tabs (which would flash) while we wait for the query to settle.
  if (onboardingComplete && !isAnonymous && subscriptionLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false, animation: "none" }}
      />
      <Stack.Screen
        name="paywall"
        options={{ headerShown: false, animation: "none" }}
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

  // ── Deferred native initialization ────────────────────────────────────────
  // These calls use void TurboModule methods. Under New Architecture, a void
  // TurboModule method that throws on a background GCD thread causes SIGSEGV
  // (Hermes heap write off the JS thread). Running them inside useEffect
  // ensures the React/Hermes runtime is fully up before any native calls fire.
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Initialize RevenueCat early so returning subscribed users get correct
    // subscription status on cold launch without going through onboarding/paywall.
    // Then invalidate cached queries so they re-run with RC initialized — the
    // customerInfo query resolves with null when rcInitialized=false, so it needs
    // a forced refetch rather than waiting for its normal staleTime to expire.
    initializeRevenueCat();
    queryClient.invalidateQueries({ queryKey: ["revenuecat"] });

    // Clear any stale AlarmKit "denied" flag written by the buggy configure()-before-auth path.
    clearStaleAlarmKitDenied().catch(() => {});

    // Configure foreground notification presentation.
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      // Swallow — if the native layer throws, we degrade gracefully
    }

    // Register the background alarm task. Extra synchronous try-catch in
    // addition to the internal one in registerBackgroundAlarmTask so that
    // any synchronous native throw before a Promise is returned is contained.
    try {
      registerBackgroundAlarmTask().catch(() => {});
    } catch {
      // Swallow — background fetch is best-effort
    }

    // Create the max-importance Android notification channel.
    if (Platform.OS === "android") {
      try {
        ensureAndroidAlarmChannel().catch(() => {});
      } catch {
        // Swallow — best-effort
      }
    }
  }, []);

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

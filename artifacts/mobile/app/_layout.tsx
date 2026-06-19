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
import { AppState, AppStateStatus, Appearance, Linking, Platform, View } from "react-native";
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
  const { onboardingComplete, isAnonymous } = useAuth();
  const { isSubscribed, isLoading: subscriptionLoading } = useSubscription();
  const segments = useSegments();
  const router = useRouter();

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
      if (!inPaywall) router.replace("/paywall");
      return;
    }

    // Subscribed — navigate to tabs if sitting on onboarding or paywall.
    if (inOnboarding || inPaywall) {
      router.replace("/(tabs)");
    }
  }, [onboardingComplete, isAnonymous, isSubscribed, subscriptionLoading, segments, router]);

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

    initAlarmKit();

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

  // ── PKCE OAuth callback — handles biblewake://?code=… deep links ─────────
  // When Supabase redirects back after Google/Apple sign-in it appends a
  // one-time `code` query param. We exchange it here for a real session.
  // The flowType: "pkce" option in lib/supabase.ts tells Supabase to expect
  // this code instead of returning tokens in the URL fragment.
  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleUrl = ({ url }: { url: string }) => {
      if (url.includes("?code=") || url.includes("&code=")) {
        supabase.auth.exchangeCodeForSession(url).catch((err) => {
          console.error("[BibleWake] PKCE code exchange failed:", err);
        });
      }
    };

    // Handle the case where the app was opened cold via the deep link.
    Linking.getInitialURL()
      .then((url) => { if (url) handleUrl({ url }); })
      .catch(() => {});

    // Handle deep links received while the app is already running.
    const subscription = Linking.addEventListener("url", handleUrl);
    return () => subscription.remove();
  }, []);

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

  // Block rendering until auth/onboarding state is resolved.
  // This must come AFTER all hooks (Rules of Hooks: no early return before hooks).
  // Without this guard, the (tabs) stack briefly flashes before the navigation
  // effect fires its redirect — visible as a "home screen flash" on first launch.
  if (onboardingComplete === null) return null;
  // Also block while subscription status is still resolving for post-onboarding,
  // non-anonymous users. Without this, the tab layout flashes for one frame
  // before the paywall redirect fires when isSubscribed turns false.
  if (onboardingComplete && !isAnonymous && subscriptionLoading) return null;

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

  // ── Deferred native initialization ────────────────────────────────────────
  // These calls use void TurboModule methods. Under New Architecture, a void
  // TurboModule method that throws on a background GCD thread causes SIGSEGV
  // (Hermes heap write off the JS thread). Running them inside useEffect
  // ensures the React/Hermes runtime is fully up before any native calls fire.
  useEffect(() => {
    if (Platform.OS === "web") return;

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

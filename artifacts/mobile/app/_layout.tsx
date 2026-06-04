import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AlarmProvider } from "@/context/AlarmContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import {
  initializeRevenueCat,
  SubscriptionProvider,
  useSubscription,
} from "@/lib/revenuecat";

SplashScreen.preventAutoHideAsync();

// Initialize RevenueCat once at module load time. Failures degrade gracefully.
try {
  initializeRevenueCat();
} catch (err: unknown) {
  if (__DEV__) {
    console.warn("[RevenueCat] Initialization failed:", err);
  }
}

const queryClient = new QueryClient();

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

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

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
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <AuthProvider>
                  <SubscriptionProvider>
                    <AlarmProvider>
                      <RootLayoutNav />
                    </AlarmProvider>
                  </SubscriptionProvider>
                </AuthProvider>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

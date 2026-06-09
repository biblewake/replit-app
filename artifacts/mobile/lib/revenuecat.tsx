import React, { createContext, useContext, useEffect, useRef } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import type PurchasesType from "react-native-purchases";
import type { CustomerInfo, PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

/** Whether RevenueCat was successfully initialized this session. */
let rcInitialized = false;

/**
 * Lazily load the native `react-native-purchases` module.
 * Returns null on web so the module is never imported there
 * (importing it on web crashes immediately).
 */
function getPurchases(): typeof PurchasesType | null {
  if (Platform.OS === "web") return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return (require("react-native-purchases") as { default: typeof PurchasesType }).default;
}

function getRevenueCatApiKey(): string | null {
  // In dev / Expo Go / web, use the test key if available.
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY ?? null;
  }

  // In production builds, use the platform-specific key.
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY ?? null;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY ?? null;

  return REVENUECAT_TEST_API_KEY ?? null;
}

export function initializeRevenueCat() {
  // Web: native module is unavailable — skip entirely.
  if (Platform.OS === "web") return;

  // Guard against double-init: Purchases.configure() on iOS 26 / StoreKit2
  // throws an NSException when called a second time, which then gets
  // marshalled onto the Hermes heap from a background GCD queue and races
  // with a JS Set iteration — causing EXC_BAD_ACCESS (SIGSEGV).
  // rcInitialized is set to true on first successful configure(), so any
  // subsequent call (e.g. from a re-mounted provider) is a safe no-op.
  if (rcInitialized) return;

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    if (__DEV__) {
      console.warn(
        "[RevenueCat] No API key found for this platform/environment. " +
        "Subscription features will be unavailable. " +
        "Make sure EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / ANDROID_API_KEY are set as EAS secrets."
      );
    }
    return;
  }

  const Purchases = getPurchases();
  if (!Purchases) return;

  try {
    Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });
    rcInitialized = true;
  } catch (err) {
    if (__DEV__) console.warn("[RevenueCat] configure() failed:", err);
  }
}

/** Safe wrapper — returns null instead of throwing if RC is not initialized. */
async function safeGetCustomerInfo(): Promise<CustomerInfo | null> {
  if (!rcInitialized) return null;
  const Purchases = getPurchases();
  if (!Purchases) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: safeGetCustomerInfo,
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      if (!rcInitialized) return null;
      const Purchases = getPurchases();
      if (!Purchases) return null;
      try {
        return await Purchases.getOfferings();
      } catch {
        return null;
      }
    },
    staleTime: 300 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      if (!rcInitialized) throw new Error("RevenueCat is not initialized");
      const Purchases = getPurchases();
      if (!Purchases) throw new Error("RevenueCat is not available on this platform");
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      if (!rcInitialized) throw new Error("RevenueCat is not initialized");
      const Purchases = getPurchases();
      if (!Purchases) throw new Error("RevenueCat is not available on this platform");
      return Purchases.restorePurchases();
    },
  });

  // Refetch subscription status whenever the app comes back to the foreground.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "active" && appStateRef.current !== "active") {
        void customerInfoQuery.refetch();
      }
      appStateRef.current = state;
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  const purchasePackage = async (pkg: PurchasesPackage): Promise<CustomerInfo> => {
    const info = await purchaseMutation.mutateAsync(pkg);
    await customerInfoQuery.refetch();
    return info;
  };

  const restore = async (): Promise<CustomerInfo> => {
    const info = await restoreMutation.mutateAsync();
    await customerInfoQuery.refetch();
    return info;
  };

  return {
    customerInfo: customerInfoQuery.data ?? null,
    offerings: offeringsQuery.data ?? null,
    isSubscribed,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchasePackage,
    restore,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;

/**
 * Web-safe stub returned by useSubscription() when running on web.
 * All purchase/restore operations throw a clear "not available on web" error.
 */
const WEB_STUB: SubscriptionContextValue = {
  customerInfo: null,
  offerings: null,
  isSubscribed: false,
  isLoading: false,
  purchasePackage: async () => {
    throw new Error("In-app purchases are not available on web");
  },
  restore: async () => {
    throw new Error("Restore purchases is not available on web");
  },
  isPurchasing: false,
  isRestoring: false,
};

const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "web") {
    return <Context.Provider value={WEB_STUB}>{children}</Context.Provider>;
  }
  return <NativeSubscriptionProvider>{children}</NativeSubscriptionProvider>;
}

function NativeSubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    if (__DEV__) {
      console.warn(
        "[RevenueCat] useSubscription called outside SubscriptionProvider — returning stub. " +
        "This usually means the root layout crashed before SubscriptionProvider mounted."
      );
      return WEB_STUB;
    }
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}

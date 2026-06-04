import React, { createContext, useContext, useEffect } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import Purchases, { type CustomerInfo, type PurchasesPackage } from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

function getRevenueCatApiKey() {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat Public API Keys not found");
  }

  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY;
  }

  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;

  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) throw new Error("RevenueCat Public API Key not found");
  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });
}

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      const info = await Purchases.getCustomerInfo();
      return info;
    },
    staleTime: 60 * 1000,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      const offerings = await Purchases.getOfferings();
      return offerings;
    },
    staleTime: 300 * 1000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage) => {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return Purchases.restorePurchases();
    },
  });

  // Refetch subscription status whenever the app comes back to the foreground
  // so an expired or cancelled subscription is detected promptly.
  useEffect(() => {
    const handleAppStateChange = (state: AppStateStatus) => {
      if (state === "active") {
        void customerInfoQuery.refetch();
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  // purchasePackage awaits refetch so callers can rely on isSubscribed being
  // updated before their onSuccess callbacks fire — critical for the hard-
  // paywall gate in _layout.tsx.
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
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchasePackage,
    restore,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
  return ctx;
}

import React, { createContext, useContext } from "react";

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

export async function initializeRevenueCat(): Promise<void> {
  // No-op stub — react-native-purchases has been removed.
}

interface SubscriptionContextValue {
  customerInfo: { managementURL?: string | null } | null;
  offerings: null;
  isSubscribed: boolean;
  isLoading: boolean;
  purchasePackage: () => Promise<null>;
  restore: () => Promise<null>;
  isPurchasing: boolean;
  isRestoring: boolean;
}

const STUB: SubscriptionContextValue = {
  customerInfo: null,
  offerings: null,
  isSubscribed: true,
  isLoading: false,
  purchasePackage: async () => null,
  restore: async () => null,
  isPurchasing: false,
  isRestoring: false,
};

const Context = createContext<SubscriptionContextValue>(STUB);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  return <Context.Provider value={STUB}>{children}</Context.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  return useContext(Context);
}

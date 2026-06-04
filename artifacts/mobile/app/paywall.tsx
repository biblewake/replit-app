import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";

import { OL, ONBOARDING_ORANGE } from "@/components/onboarding/primitives";
import { PaywallBottom } from "@/components/PaywallBottom";
import { useSubscription } from "@/lib/revenuecat";

const FEATURES = [
  {
    title: "Dismiss by Reciting Verses",
    body: "Recite your verse to turn off the alarm — starting every morning with God's Word on your lips.",
  },
  {
    title: "Track Your Scripture Growth",
    body: "Build a personal library of memorized scriptures and watch your faith foundation grow over time.",
  },
  {
    title: "Alarm Built for Your Faith",
    body: "Every alarm is paired with scripture, making your wake-up a purposeful moment of devotion.",
  },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { offerings, purchasePackage, restore, isPurchasing, isRestoring } =
    useSubscription();

  const annualPkg = offerings?.current?.availablePackages.find(
    (p) => p.identifier === "$rc_annual",
  );
  const weeklyPkg = offerings?.current?.availablePackages.find(
    (p) => p.identifier === "$rc_weekly",
  );

  const handlePurchase = async (pkg: PurchasesPackage) => {
    await purchasePackage(pkg);
    router.replace("/(tabs)");
  };

  const handleRestore = async () => {
    const info = await restore();
    const hasEntitlement =
      info?.entitlements.active?.["premium"] !== undefined;
    if (hasEntitlement) {
      router.replace("/(tabs)");
    }
  };

  const paddingTop = insets.top + (Platform.OS === "web" ? 24 : 16);

  return (
    <View
      style={[
        styles.container,
        { paddingTop, paddingBottom: insets.bottom + 24 },
      ]}
    >
      {/* Top section */}
      <View style={styles.top}>
        <Text style={styles.title}>Start waking up{"\n"}with Purpose</Text>

        <View style={styles.featureList}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureCircle}>
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              </View>
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureBody}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Bottom — shared plan toggle + CTA + footer */}
      <View style={styles.bottom}>
        <PaywallBottom
          annualPkg={annualPkg}
          weeklyPkg={weeklyPkg}
          onPurchase={handlePurchase}
          onRestore={handleRestore}
          isPurchasing={isPurchasing}
          isRestoring={isRestoring}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OL.background,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  top: {
    flex: 1,
    justifyContent: "center",
    gap: 32,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    letterSpacing: -0.8,
    lineHeight: 42,
    textAlign: "center",
  },
  featureList: {
    gap: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  featureCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ONBOARDING_ORANGE,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    lineHeight: 22,
  },
  featureBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    lineHeight: 20,
    marginTop: 2,
  },
  bottom: {},
});

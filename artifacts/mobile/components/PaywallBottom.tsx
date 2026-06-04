import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { PurchasesPackage } from "react-native-purchases";

import { OL, ONBOARDING_ORANGE } from "@/components/onboarding/primitives";

type Plan = "yearly" | "weekly";

function openPrivacy() {
  Linking.openURL("https://trybiblewake.com/privacy-policy").catch(() => {});
}
function openTerms() {
  Linking.openURL("https://trybiblewake.com/terms").catch(() => {});
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

/** Derive trial label from store product intro price metadata. Returns null when no trial. */
function getTrialLabel(pkg: PurchasesPackage | undefined): string | null {
  const introPrice = pkg?.product.introPrice as
    | { periodNumberOfUnits?: number; periodUnit?: string; paymentMode?: string }
    | null
    | undefined;
  if (!introPrice) return null;
  const units = introPrice.periodNumberOfUnits;
  const unit = introPrice.periodUnit?.toLowerCase() ?? "day";
  if (units == null) return "Free trial";
  return `${units}-${unit} free trial`;
}

interface PaywallBottomProps {
  annualPkg: PurchasesPackage | undefined;
  weeklyPkg: PurchasesPackage | undefined;
  onPurchase: (pkg: PurchasesPackage) => Promise<void>;
  onRestore: () => Promise<void>;
  isPurchasing: boolean;
  isRestoring: boolean;
  defaultPlan?: Plan;
  /** Called whenever the user switches plan tabs, so parents can sync state. */
  onPlanChange?: (plan: Plan) => void;
}

export function PaywallBottom({
  annualPkg,
  weeklyPkg,
  onPurchase,
  onRestore,
  isPurchasing,
  isRestoring,
  defaultPlan = "yearly",
  onPlanChange,
}: PaywallBottomProps) {
  const [plan, setPlan] = useState<Plan>(defaultPlan);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingPkg, setPendingPkg] = useState<PurchasesPackage | null>(null);

  const isYearly = plan === "yearly";

  const selectPlan = (p: Plan) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setPlan(p);
    onPlanChange?.(p);
  };

  // Prices come entirely from the store package; no hardcoded fallbacks.
  const annualPrice = annualPkg?.product.priceString;
  const weeklyPrice = weeklyPkg?.product.priceString;
  const annualPriceNum = annualPkg?.product.price;
  const perWeekAnnual =
    annualPriceNum != null ? `$${(annualPriceNum / 52).toFixed(2)}/week` : null;

  // Trial label and intro price string — both derived from package metadata only.
  const trialLabel = getTrialLabel(annualPkg);
  const introPriceStr = (
    annualPkg?.product.introPrice as { priceString?: string } | null | undefined
  )?.priceString;

  const handleCta = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const pkg = isYearly ? annualPkg : weeklyPkg;
    if (!pkg) return;
    if (__DEV__) {
      setPendingPkg(pkg);
      setConfirmVisible(true);
    } else {
      void onPurchase(pkg);
    }
  };

  const confirmPurchase = async () => {
    if (!pendingPkg) return;
    setConfirmVisible(false);
    await onPurchase(pendingPkg);
  };

  const handleRestore = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onRestore();
  };

  const isBusy = isPurchasing || isRestoring;
  // CTA text is fully derived from RC package metadata — no hardcoded prices.
  const ctaLabel = isYearly
    ? trialLabel && introPriceStr != null
      ? `Try for ${introPriceStr} →`
      : annualPrice
        ? "Get Annual →"
        : "Get Started"
    : "Get Started";

  return (
    <View style={styles.container}>
      {/* Plan toggle */}
      <View style={styles.planToggle}>
        {/* Weekly */}
        <Pressable
          onPress={() => selectPlan("weekly")}
          style={[
            styles.planOption,
            !isYearly
              ? { borderColor: ONBOARDING_ORANGE, backgroundColor: `${ONBOARDING_ORANGE}12` }
              : { borderColor: OL.border },
          ]}
        >
          <View style={styles.planRow}>
            <View style={[styles.planRadio, { borderColor: !isYearly ? ONBOARDING_ORANGE : OL.border }]}>
              {!isYearly ? <View style={[styles.planRadioDot, { backgroundColor: ONBOARDING_ORANGE }]} /> : null}
            </View>
            <View>
              <Text style={[styles.planName, { color: OL.mutedForeground }]}>Weekly</Text>
              {weeklyPrice ? (
                <Text style={[styles.planPriceBold, { color: OL.foreground }]}>{weeklyPrice}/week</Text>
              ) : null}
            </View>
          </View>
        </Pressable>

        {/* Yearly */}
        <Pressable
          onPress={() => selectPlan("yearly")}
          style={[
            styles.planOption,
            isYearly
              ? { borderColor: ONBOARDING_ORANGE, backgroundColor: `${ONBOARDING_ORANGE}12` }
              : { borderColor: OL.border },
          ]}
        >
          {/* Trial badge — only shown when the store product includes an intro offer */}
          {trialLabel ? (
            <View style={styles.trialTagWrap}>
              <View
                style={[
                  styles.trialTag,
                  {
                    backgroundColor: isYearly ? ONBOARDING_ORANGE : OL.card,
                    borderColor: isYearly ? ONBOARDING_ORANGE : OL.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.trialTagText, { color: isYearly ? "#FFFFFF" : OL.mutedForeground }]}>
                  {trialLabel}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={styles.planRow}>
            <View style={[styles.planRadio, { borderColor: isYearly ? ONBOARDING_ORANGE : OL.border }]}>
              {isYearly ? <View style={[styles.planRadioDot, { backgroundColor: ONBOARDING_ORANGE }]} /> : null}
            </View>
            <View>
              <Text style={[styles.planName, { color: OL.mutedForeground }]}>Yearly</Text>
              {perWeekAnnual ? (
                <Text style={[styles.planPriceBold, { color: OL.foreground }]}>{perWeekAnnual}</Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      </View>

      {/* "No Payment Due Now" badge — only when yearly and a free trial exists */}
      {isYearly && trialLabel ? (
        <View style={styles.noPay}>
          <Ionicons name="checkmark" size={16} color={OL.foreground} />
          <Text style={styles.noPayText}>No Payment Due Now</Text>
        </View>
      ) : null}

      {/* CTA */}
      <Pressable
        disabled={isBusy || (!annualPkg && !weeklyPkg)}
        onPress={handleCta}
        style={({ pressed }) => [
          styles.ctaBtn,
          { backgroundColor: ONBOARDING_ORANGE, opacity: pressed || isBusy ? 0.8 : 1 },
        ]}
      >
        {isPurchasing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        )}
      </Pressable>

      {/* Yearly pricing note — show full annual price + per-week breakdown */}
      {isYearly && annualPrice && perWeekAnnual ? (
        <Text style={styles.pricingNote}>{annualPrice} per year ({perWeekAnnual})</Text>
      ) : null}

      {/* Footer links */}
      <View style={styles.linksRow}>
        <LinkText label="Privacy" onPress={openPrivacy} />
        <Text style={styles.linkDot}>·</Text>
        <LinkText
          label={isRestoring ? "Restoring…" : "Restore"}
          onPress={() => { void handleRestore(); }}
        />
        <Text style={styles.linkDot}>·</Text>
        <LinkText label="Terms" onPress={openTerms} />
      </View>

      {/* DEV confirm modal — prevents accidental test charges */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Test Purchase</Text>
            <Text style={styles.modalBody}>
              Confirm test purchase:{"\n"}
              <Text style={{ fontFamily: "Inter_700Bold", color: ONBOARDING_ORANGE }}>
                {pendingPkg?.product.priceString ?? ""} {pendingPkg?.product.title ?? ""}
              </Text>
            </Text>
            <Pressable
              style={[styles.modalBtn, { backgroundColor: ONBOARDING_ORANGE }]}
              onPress={() => { void confirmPurchase(); }}
            >
              <Text style={styles.modalBtnText}>Confirm Purchase</Text>
            </Pressable>
            <Pressable
              style={[styles.modalBtn, styles.modalBtnCancel]}
              onPress={() => setConfirmVisible(false)}
            >
              <Text style={[styles.modalBtnText, { color: OL.foreground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingTop: 4,
  },
  planToggle: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  planOption: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    paddingTop: 10,
    overflow: "visible",
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  planRadioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  planName: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  planPriceBold: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginTop: 1,
  },
  trialTagWrap: {
    position: "absolute",
    top: -11,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  trialTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  trialTagText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  noPay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  noPayText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: OL.foreground,
  },
  ctaBtn: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  pricingNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    textAlign: "center",
  },
  linksRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  linkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    textDecorationLine: "underline",
  },
  linkDot: {
    fontSize: 12,
    color: OL.mutedForeground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: OL.background,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    textAlign: "center",
    lineHeight: 22,
  },
  modalBtn: {
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnCancel: {
    backgroundColor: OL.secondary,
  },
  modalBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

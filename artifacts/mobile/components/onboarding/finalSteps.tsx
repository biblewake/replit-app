import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import { PhoneDemoVideo } from "@/components/onboarding/PhoneDemoVideo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { OL, ONBOARDING_ORANGE } from "@/components/onboarding/primitives";
import { useSubscription } from "@/lib/revenuecat";
import type { PurchasesPackage } from "react-native-purchases";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

/* ──────────────────────────────────────────────────────────────────────────
 * AnalysisScreen — step 28. Orange circle checkmarks, slow zone 60–85%,
 * haptic per item, narrow progress bar, no summary text.
 * ────────────────────────────────────────────────────────────────────────── */
const ANALYSIS_ITEMS = [
  "Building your morning routine",
  "Matching your scripture verse",
  "Configuring your alarm",
  "Personalizing your journey",
];

export function AnalysisScreen({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const prevDoneRef = useRef(0);

  useEffect(() => {
    const listener = progress.addListener(({ value }) => {
      const p = Math.round(value * 100);
      setPct(p);
      const done =
        p >= 100 ? 4 : p >= 75 ? 3 : p >= 50 ? 2 : p >= 25 ? 1 : 0;
      setDoneCount(done);
    });

    // Sequence: fast → slow zone (60-85%) → fast finish
    Animated.sequence([
      Animated.timing(progress, {
        toValue: 0.6,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progress, {
        toValue: 0.85,
        duration: 2400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }),
      Animated.timing(progress, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start(() => {
      progress.removeListener(listener);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(onDone, 400);
    });

    return () => {
      progress.removeListener(listener);
    };
  }, [progress, onDone]);

  // Haptic when a new item checks off
  useEffect(() => {
    if (doneCount > prevDoneRef.current) {
      prevDoneRef.current = doneCount;
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    }
  }, [doneCount]);

  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.analysisWrap}>
      <Text style={styles.analysisTitle}>We're setting everything up for you</Text>
      <Text style={styles.analysisPct}>{pct}%</Text>

      {/* Narrow progress bar */}
      <View style={styles.analysisTrack}>
        <Animated.View style={[styles.analysisFill, { width: barWidth }]} />
      </View>

      {/* Checklist centered */}
      <View style={styles.analysisList}>
        {ANALYSIS_ITEMS.map((label, i) => {
          const done = i < doneCount;
          return (
            <View key={label} style={styles.analysisRow}>
              <View
                style={[
                  styles.analysisCircle,
                  {
                    backgroundColor: done ? ONBOARDING_ORANGE : OL.border,
                  },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                ) : null}
              </View>
              <Text
                style={[
                  styles.analysisRowText,
                  { color: done ? OL.foreground : OL.mutedForeground },
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * AccountScreen — step 29. Apple first, Google white with colored "G".
 * ────────────────────────────────────────────────────────────────────────── */
export function AccountScreen({ onContinue }: { onContinue: () => void }) {
  const { signInWithGoogle, signInWithApple, signInAnonymously, session, isGuest } = useAuth();
  const [busy, setBusy] = useState<null | "google" | "apple" | "anon">(null);

  // If a valid non-anonymous session already exists on mount, advance immediately.
  // This covers the case where the user re-enters onboarding with an existing account.
  useEffect(() => {
    if (session && !session.user?.is_anonymous) {
      onContinue();
    }
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance when a real (non-anonymous) session arrives after mount, or when
  // the guest flag is set (non-Supabase dev path).
  useEffect(() => {
    if ((session && !session.user?.is_anonymous) || isGuest) onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isGuest]);

  // Fallback: subscribe directly to Supabase auth state changes so that PKCE
  // session delivery (Google sign-in) triggers onContinue() even if the
  // AuthContext → AccountScreen prop chain has a timing gap.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (newSession && !newSession.user?.is_anonymous) {
          onContinue();
        }
      }
    );
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (provider: "google" | "apple") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(provider);
    try {
      if (provider === "google") await signInWithGoogle();
      else await signInWithApple();
    } catch {
      // surfaced by AuthContext
    } finally {
      setBusy(null);
    }
  };

  const runAnon = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy("anon");
    try {
      await signInAnonymously();
      // Call onContinue() directly — do not rely on the reactive useEffect.
      // The anonymous Supabase session sets user.is_anonymous === true, which
      // would not satisfy the useEffect condition above.
      onContinue();
    } catch {
      // surfaced by AuthContext
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.accountWrap}>
      <View style={styles.accountHeader}>
        <Text style={[styles.accountTitle, { color: OL.foreground }]}>
          Save your progress
        </Text>
        <Text style={[styles.accountSubtitle, { color: OL.mutedForeground }]}>
          Create an account so your alarms, streaks, and memorized verses are
          backed up and synced.
        </Text>
      </View>

      <View style={styles.authButtons}>
        {/* Apple — black, shown on iOS only */}
        {Platform.OS === "ios" ? (
          <Pressable
            disabled={busy !== null}
            onPress={() => run("apple")}
            style={({ pressed }) => [
              styles.authBtn,
              { backgroundColor: "#000000", opacity: pressed ? 0.88 : 1 },
            ]}
          >
            {busy === "apple" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                <Text style={[styles.authBtnText, { color: "#FFFFFF" }]}>
                  Continue with Apple
                </Text>
              </>
            )}
          </Pressable>
        ) : null}

        {/* Google — white with border, colored "G" */}
        <Pressable
          disabled={busy !== null}
          onPress={() => run("google")}
          style={({ pressed }) => [
            styles.authBtn,
            styles.googleBtn,
            { opacity: pressed ? 0.88 : 1 },
          ]}
        >
          {busy === "google" ? (
            <ActivityIndicator color={OL.foreground} />
          ) : (
            <>
              <Image source={require("../../assets/images/google_icon.png")} style={styles.googleIcon} />
              <Text style={[styles.authBtnText, { color: OL.foreground }]}>
                Continue with Google
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Anonymous skip link */}
      <Pressable
        disabled={busy !== null}
        onPress={() => { void runAnon(); }}
        hitSlop={10}
        style={({ pressed }) => [styles.anonLink, { opacity: pressed ? 0.6 : 1 }]}
      >
        {busy === "anon" ? (
          <ActivityIndicator size="small" color={OL.mutedForeground} />
        ) : (
          <Text style={styles.anonLinkText}>Continue without an account</Text>
        )}
      </Pressable>

    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Paywall — step 30. Three pages wired to RevenueCat.
 * ────────────────────────────────────────────────────────────────────────── */
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

/** Extract trial info from a package's intro price. Returns null when no intro offer. */
function getIntroOffer(pkg: PurchasesPackage | undefined) {
  const intro = pkg?.product.introPrice as
    | { priceString?: string; periodNumberOfUnits?: number; periodUnit?: string }
    | null
    | undefined;
  if (!intro) return null;
  return {
    priceString: intro.priceString,
    days: intro.periodNumberOfUnits,
    unit: intro.periodUnit?.toLowerCase() ?? "day",
  };
}

/* Page A — design/marketing slide. CTA simply advances to next page. */
interface PageAProps {
  onContinue: () => void;
  onRestore: () => void;
  isRestoring: boolean;
}

function PageA({ onContinue, onRestore, isRestoring }: PageAProps) {
  return (
    <View style={styles.pageWrap}>
      <View style={styles.pageHero}>
        <Text style={styles.pageATitleLarge}>
          We want you to try{"\n"}Bible Wake for free.
        </Text>
        <PhoneDemoVideo style={styles.phoneDemoVideo} />
      </View>

      <View style={styles.pageFooter}>
        <View style={styles.trustBadge}>
          <Ionicons name="checkmark" size={18} color="#000000" />
          <Text style={styles.trustBadgeText}>No Payment Due Now</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onContinue();
          }}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: ONBOARDING_ORANGE, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>Try for $0.00</Text>
        </Pressable>
        <Text style={styles.noCommit}>No commitment, cancel anytime.</Text>
        <View style={styles.linksRow}>
          <LinkText label="Privacy" onPress={openPrivacy} />
          <Text style={styles.linkDot}>·</Text>
          <LinkText
            label={isRestoring ? "Restoring…" : "Restore Purchase"}
            onPress={onRestore}
          />
          <Text style={styles.linkDot}>·</Text>
          <LinkText label="Terms" onPress={openTerms} />
        </View>
      </View>
    </View>
  );
}

/* Page B — design/marketing slide. CTA simply advances to next page. */
interface PageBProps {
  onContinue: () => void;
}

function PageB({ onContinue }: PageBProps) {
  return (
    <View style={styles.pageWrap}>
      <Text style={styles.pageBTitle}>
        {"We\u2019ll send you a\nreminder before your\nfree trial ends"}
      </Text>
      <View style={[styles.pageHero, { gap: 20 }]}>
        <LottieView
          source={require("../../assets/animations/notification-bell.json")}
          autoPlay
          loop
          style={styles.pageBLottie}
        />
      </View>

      <View style={styles.pageFooter}>
        <View style={styles.trustBadge}>
          <Ionicons name="checkmark" size={18} color="#000000" />
          <Text style={styles.trustBadgeText}>No Payment Due Now</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onContinue();
          }}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: ONBOARDING_ORANGE, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
        <Text style={styles.pricingNote}>Just $0.76/week ($39.99 per year)</Text>
      </View>
    </View>
  );
}

/* Page C — "How your free trial works" / "Choose your plan" */
interface PageCProps {
  onPurchase: (pkg: PurchasesPackage) => Promise<void>;
  onRestore: () => Promise<void>;
  annualPkg: PurchasesPackage | undefined;
  weeklyPkg: PurchasesPackage | undefined;
  isPurchasing: boolean;
  isRestoring: boolean;
}

function PageC({
  onPurchase,
  onRestore,
  annualPkg,
  weeklyPkg,
  isPurchasing,
  isRestoring,
}: PageCProps) {
  const [plan, setPlan] = useState<"yearly" | "weekly">("yearly");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingPkg, setPendingPkg] = useState<PurchasesPackage | null>(null);

  const isYearly = plan === "yearly";

  // Loading state — offerings not yet available.
  if (!annualPkg && !weeklyPkg) {
    return (
      <View style={styles.pageCLoader}>
        <ActivityIndicator size="large" color={ONBOARDING_ORANGE} />
      </View>
    );
  }

  // Trial info — derived entirely from package metadata, never hardcoded.
  const annualIntro = getIntroOffer(annualPkg);
  const trialDays = annualIntro?.days ?? null;
  const hasTrial = trialDays != null;
  const displayTrialDays = trialDays ?? 3;

  // Prices from store metadata only.
  const annualPrice = annualPkg?.product.priceString;
  const weeklyPrice = weeklyPkg?.product.priceString;
  const annualPriceNum = annualPkg?.product.price;
  const perWeekAnnual =
    annualPriceNum != null
      ? `$${(Math.floor((annualPriceNum / 52) * 100) / 100).toFixed(2)}/week`
      : null;

  // Dynamic copy derived from plan + trial state.
  const title = "How your free trial works";

  const showTrialTimeline = isYearly;

  const step2Label = showTrialTimeline
    ? `In ${displayTrialDays - 1} Day${displayTrialDays - 1 !== 1 ? "s" : ""}`
    : "Today";
  const step2Body = showTrialTimeline
    ? "We'll send you a reminder that your trial is ending soon."
    : "We won't send you a reminder since you will be charged immediately.";

  const step3Label = showTrialTimeline
    ? `In ${displayTrialDays} Day${displayTrialDays !== 1 ? "s" : ""}`
    : "Today";
  const step3Body = showTrialTimeline
    ? `You'll be charged after your ${displayTrialDays}-day trial unless you cancel anytime before.`
    : "You'll be charged immediately.";

  const trustText =
    isYearly && hasTrial ? "No Payment Due Now" : "No Commitment, Cancel Anytime";

  const subCtaText = isYearly
    ? hasTrial
      ? `${trialDays} days free then ${annualPrice ?? "…"}/year${perWeekAnnual ? ` (${perWeekAnnual})` : ""}`
      : `${annualPrice ?? "…"}/year${perWeekAnnual ? ` (${perWeekAnnual})` : ""}`
    : `Get access today for ${weeklyPrice ?? "…"}/week`;

  const selectPlan = (p: "yearly" | "weekly") => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setPlan(p);
  };

  const handleCta = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const pkg = isYearly ? annualPkg : weeklyPkg;
    if (!pkg) return;
    if (__DEV__) {
      setPendingPkg(pkg);
      setConfirmVisible(true);
    } else {
      onPurchase(pkg).catch(() => {});
    }
  };

  const confirmPurchase = async () => {
    if (!pendingPkg) return;
    setConfirmVisible(false);
    await onPurchase(pendingPkg).catch(() => {});
  };

  const handleRestore = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await onRestore().catch(() => {});
  };

  const isBusy = isPurchasing;

  return (
    <ScrollView
      style={styles.pageCScroll}
      contentContainerStyle={styles.pageCContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Text style={styles.pageCTitle}>{title}</Text>

      {/* Timeline */}
      <View style={styles.timeline}>
        {/* Step 1 — Today */}
        <View style={styles.timelineRow}>
          <View style={styles.timelineIconWrap}>
            {/* Rod behind circle — starts at circle centre so top is fully hidden */}
            <LinearGradient
              colors={["#FFD190", "#FFD190"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.timelineLine, { top: 22 }]}
            />
            <View style={[styles.timelineIcon, { backgroundColor: ONBOARDING_ORANGE }]}>
              <Ionicons name="lock-closed" size={22} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.timelineText}>
            <Text style={styles.timelineLabel}>Today</Text>
            <Text style={styles.timelineBody}>
              Unlock all the app&apos;s features like smart accountability alarms,
              bible verse analytics, streak tracking, and more.
            </Text>
          </View>
        </View>

        {/* Step 2 — Reminder */}
        <View style={styles.timelineRow}>
          <View style={styles.timelineIconWrap}>
            <LinearGradient
              colors={["#FFD190", "#FFD190", "#75DFBB"]}
              locations={[0, 0.55, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.timelineLine, { top: 22 }]}
            />
            <View style={[styles.timelineIcon, { backgroundColor: ONBOARDING_ORANGE }]}>
              <Ionicons name="notifications" size={22} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.timelineText}>
            <Text style={styles.timelineLabel}>{step2Label}</Text>
            <Text style={styles.timelineBody}>{step2Body}</Text>
          </View>
        </View>

        {/* Step 3 — Billing */}
        <View style={styles.timelineRow}>
          <View style={styles.timelineIconWrap}>
            {/* Final decorative rod — slightly longer than text, rounded at the bottom */}
            <LinearGradient
              colors={["#75DFBB", "#75DFBB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={[styles.timelineLine, { top: 22 }, styles.timelineLineEnd]}
            />
            <View style={[styles.timelineIcon, { backgroundColor: "#079867" }]}>
              <Ionicons name="star" size={22} color="#FFFFFF" />
            </View>
          </View>
          <View style={[styles.timelineText, { paddingBottom: 56 }]}>
            <Text style={styles.timelineLabel}>{step3Label}</Text>
            <Text style={styles.timelineBody}>{step3Body}</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* Plan selector cards */}
      <View style={styles.planRow}>
        {/* Weekly card */}
        <Pressable
          onPress={() => selectPlan("weekly")}
          style={[
            styles.planCard,
            !isYearly
              ? { borderColor: ONBOARDING_ORANGE, backgroundColor: `${ONBOARDING_ORANGE}12` }
              : { borderColor: OL.border },
          ]}
        >
          <View style={styles.planCardInner}>
            <View>
              <Text style={styles.planCardLabel}>weekly</Text>
              <Text style={styles.planCardPrice}>
                {weeklyPrice ? `${weeklyPrice}/week` : "…"}
              </Text>
            </View>
            <View
              style={[
                styles.planCardRadio,
                { borderColor: !isYearly ? ONBOARDING_ORANGE : OL.border,
                  backgroundColor: !isYearly ? ONBOARDING_ORANGE : "transparent" },
              ]}
            >
              {!isYearly ? (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              ) : null}
            </View>
          </View>
        </Pressable>

        {/* Yearly card */}
        <Pressable
          onPress={() => selectPlan("yearly")}
          style={[
            styles.planCard,
            { overflow: "visible" },
            isYearly
              ? { borderColor: ONBOARDING_ORANGE, backgroundColor: `${ONBOARDING_ORANGE}12` }
              : { borderColor: OL.border },
          ]}
        >
          {isYearly ? (
            <View style={styles.trialBadgeWrap}>
              <View style={styles.trialBadge}>
                <Text style={styles.trialBadgeText}>3-day free trial</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.planCardInner}>
            <View>
              <Text style={styles.planCardLabel}>yearly</Text>
              <Text style={styles.planCardPrice}>
                {perWeekAnnual ?? "…"}
              </Text>
            </View>
            <View
              style={[
                styles.planCardRadio,
                { borderColor: isYearly ? ONBOARDING_ORANGE : OL.border,
                  backgroundColor: isYearly ? ONBOARDING_ORANGE : "transparent" },
              ]}
            >
              {isYearly ? (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              ) : null}
            </View>
          </View>
        </Pressable>
      </View>

      {/* Trust row */}
      <View style={styles.trustBadge}>
        <Ionicons name="checkmark" size={18} color={OL.foreground} />
        <Text style={styles.trustBadgeText}>{trustText}</Text>
      </View>

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
          <Text style={styles.ctaText}>Continue</Text>
        )}
      </Pressable>

      {/* Sub-CTA */}
      <Text style={styles.pageCSubCta}>{subCtaText}</Text>

      {/* Footer links */}
      <View style={styles.linksRow}>
        <LinkText
          label={isRestoring ? "Restoring…" : "Restore Purchases"}
          onPress={() => { void handleRestore(); }}
        />
        <Text style={styles.linkDot}>·</Text>
        <LinkText label="Terms" onPress={openTerms} />
        <Text style={styles.linkDot}>·</Text>
        <LinkText label="Privacy" onPress={openPrivacy} />
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
    </ScrollView>
  );
}

/* ── Paywall container — manages page flow + RevenueCat integration ── */
export function Paywall({ onComplete }: { onComplete: () => void }) {
  const [page, setPage] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const { offerings, purchasePackage, restore, isPurchasing, isRestoring } = useSubscription();

  // RC is now initialized earlier (step 28 onDone) so by the time the user
  // reaches Page C the offerings fetch has already resolved. No init needed here.

  const annualPkg = offerings?.current?.availablePackages.find(
    (p) => p.identifier === "$rc_annual",
  );
  const weeklyPkg = offerings?.current?.availablePackages.find(
    (p) => p.identifier === "$rc_weekly",
  );

  const goPage = (next: number) => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 130, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
    setPage(next);
  };

  // Purchase and restore — called only from Page C (PaywallBottom).
  const handlePurchase = async (pkg: PurchasesPackage) => {
    try {
      const info = await purchasePackage(pkg);
      // Only advance when the purchase actually completed (non-null CustomerInfo).
      // A null return means the user cancelled or RevenueCat silently surfaced an
      // already-owned receipt — in those cases the cache/gatekeeper will redirect
      // automatically once isSubscribed settles, so calling onComplete() here with
      // stale state would cause the redirect-to-Page-A race condition.
      if (info) onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert("Purchase Failed", msg);
    }
  };

  const handleRestore = async () => {
    try {
      const info = await restore();
      if (info?.entitlements.active?.["premium"] !== undefined) {
        onComplete();
      } else if (info !== null) {
        Alert.alert("No Purchases Found", "We couldn't find any previous purchases to restore.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      Alert.alert("Restore Failed", msg);
    }
  };

  return (
    <Animated.View style={[styles.paywallWrap, { opacity: fade }]}>
      {/* PageA is always mounted so PhoneDemoVideo buffers before the user arrives */}
      <View
        style={page === 0 ? styles.paywallPage : styles.paywallPageHidden}
        pointerEvents={page === 0 ? "auto" : "none"}
      >
        <PageA
          onContinue={() => goPage(1)}
          onRestore={() => { void handleRestore(); }}
          isRestoring={isRestoring}
        />
      </View>
      {page === 1 && (
        <PageB
          onContinue={() => goPage(2)}
        />
      )}
      {page === 2 && (
        <PageC
          onPurchase={handlePurchase}
          onRestore={handleRestore}
          annualPkg={annualPkg}
          weeklyPkg={weeklyPkg}
          isPurchasing={isPurchasing}
          isRestoring={isRestoring}
        />
      )}
    </Animated.View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  /* AnalysisScreen */
  analysisWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
  },
  analysisTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    color: OL.foreground,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  analysisPct: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    letterSpacing: -1,
  },
  analysisTrack: {
    width: "70%",
    height: 5,
    borderRadius: 3,
    backgroundColor: OL.border,
    overflow: "hidden",
  },
  analysisFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: ONBOARDING_ORANGE,
  },
  analysisList: {
    width: "100%",
    gap: 16,
    marginTop: 10,
    alignItems: "center",
  },
  analysisRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "80%",
  },
  analysisCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  analysisRowText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },

  /* AccountScreen */
  accountWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 28,
  },
  accountHeader: {
    alignItems: "center",
    gap: 12,
  },
  accountTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  accountSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  authButtons: {
    gap: 12,
  },
  authBtn: {
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: OL.border,
  },
  googleIcon: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  authBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  anonLink: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    minHeight: 28,
  },
  anonLinkText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    textDecorationLine: "underline",
  },

  /* Paywall shared */
  paywallWrap: {
    flex: 1,
  },
  paywallPage: {
    flex: 1,
  },
  paywallPageHidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  pageWrap: {
    flex: 1,
    justifyContent: "space-between",
  },
  pageHero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 4,
  },
  pageFooter: {
    gap: 10,
    paddingTop: 8,
  },

  /* Page A */
  pageATitleLarge: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    color: OL.foreground,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  pageTitleQuote: {
    fontFamily: "Inter_700Bold",
  },
  mockupFrame: {
    width: 190,
    height: 230,
    borderRadius: 24,
    backgroundColor: "#1C1C1E",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  mockupInner: {
    alignItems: "center",
    gap: 8,
  },
  mockupAppName: {
    color: ONBOARDING_ORANGE,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  mockupEmoji: {
    fontSize: 42,
  },
  mockupWakeText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  mockupVerseText: {
    color: "#8E8E93",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  /* Page B */
  pageBTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    color: OL.foreground,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  pageBLottie: {
    width: 220,
    height: 220,
  },
  pageBImage: {
    width: 100,
    height: 100,
  },
  pageBBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    color: OL.mutedForeground,
    lineHeight: 22,
    maxWidth: 300,
  },

  /* Page C — layout */
  pageCScroll: {
    flex: 1,
  },
  pageCContent: {
    flexGrow: 1,
    gap: 14,
    paddingBottom: 0,
  },
  pageCLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pageCTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    letterSpacing: -0.5,
    lineHeight: 36,
    textAlign: "center",
  },
  pageCSubCta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    textAlign: "center",
  },

  /* Page C — plan selector cards */
  planRow: {
    flexDirection: "row",
    gap: 10,
  },
  planCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    paddingTop: 18,
  },
  planCardInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planCardLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    marginBottom: 2,
  },
  planCardPrice: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
  },
  planCardRadio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Trial badge pill */
  trialBadgeWrap: {
    position: "absolute",
    top: -12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  trialBadge: {
    backgroundColor: ONBOARDING_ORANGE,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  trialBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },

  /* Page C — timeline */
  timeline: {
    gap: 0,
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 0,
  },
  timelineIconWrap: {
    alignItems: "center",
    width: 44,
    alignSelf: "stretch",
  },
  timelineIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 14,
    left: 15,
  },
  timelineLineEnd: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  timelineText: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 18,
  },
  timelineLabel: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    marginBottom: 3,
  },
  timelineBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    lineHeight: 18,
  },

  /* Phone demo video hero */
  phoneDemoVideo: {
    flex: 1,
    width: "100%",
    minHeight: 0,
  },

  /* Trust badge row ("✓ No Payment Due Now") */
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 4,
  },
  trustBadgeText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: OL.foreground,
  },

  /* Shared CTA + footer (for Pages A & B which don't use PaywallBottom) */
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
  noCommit: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    textAlign: "center",
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
    paddingBottom: 10,
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

  /* DEV confirm modal (Pages A & B) */
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

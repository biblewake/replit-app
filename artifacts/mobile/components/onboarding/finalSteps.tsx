import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { supabase } from "@/lib/supabase";
import { OL, ONBOARDING_ORANGE } from "@/components/onboarding/primitives";
import { initializeRevenueCat, useSubscription } from "@/lib/revenuecat";
import { PaywallBottom } from "@/components/PaywallBottom";
import type { PurchasesPackage } from "react-native-purchases";
import { useQueryClient } from "@tanstack/react-query";

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
  const showGuestLogin = useFeatureFlag("show_guest_login");

  // Sign out any STALE anonymous session left over from a previous install.
  // We only sign out if the session was created more than 5 seconds ago —
  // this prevents the signout from racing with a freshly-arrived Google PKCE
  // session. The PKCE exchange fires onAuthStateChange which creates a new
  // real session; if we blindly sign it out here the user gets stuck on this
  // screen even after a successful Google sign-in.
  useEffect(() => {
    if (session?.user?.is_anonymous === true) {
      const createdAt = session.user.created_at
        ? new Date(session.user.created_at).getTime()
        : 0;
      const ageMs = Date.now() - createdAt;
      if (ageMs > 5000) {
        supabase.auth.signOut().catch(() => {});
      }
    }
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance only when a real (non-anonymous) signed-in session exists, or the
  // user explicitly chose guest mode.
  // Primary path: AuthContext propagates the session update via props.
  useEffect(() => {
    if ((session && !session.user?.is_anonymous) || isGuest) onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isGuest]);

  // Fallback path: subscribe directly to Supabase auth state changes so that
  // PKCE session delivery (Google sign-in) triggers onContinue() even if the
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

      {/* Anonymous skip link — visible only when show_guest_login flag is true */}
      {showGuestLogin ? (
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
      ) : null}

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
          We want you to try{"\n"}
          <Text style={styles.pageTitleQuote}>&quot;Bible Wake&quot;</Text>
          {" "}for free.
        </Text>
        <View style={styles.mockupFrame}>
          <View style={styles.mockupInner}>
            <Text style={styles.mockupAppName}>Bible Wake</Text>
            <Text style={styles.mockupEmoji}>📖</Text>
            <Text style={styles.mockupWakeText}>Time to Wake Up!</Text>
            <Text style={styles.mockupVerseText}>Recite your scripture</Text>
          </View>
        </View>
      </View>

      <View style={styles.pageFooter}>
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
      <View style={[styles.pageHero, { gap: 20 }]}>
        <Text style={styles.pageBTitle}>
          {"We\u2019ll send you a\nreminder before your\nfree trial ends"}
        </Text>
        <Image
          source={require("../../assets/images/notification.png")}
          style={styles.pageBImage}
          resizeMode="contain"
        />
        <Text style={styles.pageBBody}>
          {"We\u2019ll send you a reminder before your trial ends. No surprise charges."}
        </Text>
      </View>

      <View style={styles.pageFooter}>
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
      </View>
    </View>
  );
}

/* Page C — How your free trial works, with plan toggle via PaywallBottom */
function futureDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
  const isYearly = plan === "yearly";
  // Trial duration derived from package intro price metadata — no hardcoded days.
  const annualIntro = getIntroOffer(annualPkg);
  const trialDays = annualIntro?.days ?? null;
  const billingDate = futureDateStr(isYearly && trialDays != null ? trialDays : 0);

  return (
    <View style={styles.pageWrap}>
      {/* Top: title + timeline */}
      <View style={styles.pageCTop}>
        <Text style={styles.pageCTitle}>How your free trial works</Text>

        <View style={styles.timeline}>
          {/* Today */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineIconWrap}>
              <View style={[styles.timelineIcon, { backgroundColor: "#8E8E93" }]}>
                <Ionicons name="lock-closed-outline" size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.timelineLine, { backgroundColor: OL.border }]} />
            </View>
            <View style={styles.timelineText}>
              <Text style={styles.timelineLabel}>Today</Text>
              <Text style={styles.timelineBody}>
                Unlock unlimited access to all features and the content library.
              </Text>
            </View>
          </View>

          {/* Day 2 */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineIconWrap}>
              <View style={[styles.timelineIcon, { backgroundColor: "#8E8E93" }]}>
                <Ionicons name="notifications-outline" size={16} color="#FFFFFF" />
              </View>
              <View style={[styles.timelineLine, { backgroundColor: OL.border }]} />
            </View>
            <View style={styles.timelineText}>
              <Text style={styles.timelineLabel}>
                {isYearly && trialDays != null
                  ? `In ${trialDays - 1} Day${trialDays - 1 !== 1 ? "s" : ""} – Reminder`
                  : "Today"}
              </Text>
              <Text style={styles.timelineBody}>
                {isYearly && trialDays != null
                  ? "We'll send you a reminder that your trial is ending soon."
                  : `Payment of ${weeklyPkg?.product.priceString ?? "…"} will be charged today.`}
              </Text>
            </View>
          </View>

          {/* Day 3 */}
          <View style={styles.timelineRow}>
            <View style={styles.timelineIconWrap}>
              <View style={[styles.timelineIcon, { backgroundColor: ONBOARDING_ORANGE }]}>
                <Ionicons name="ribbon-outline" size={16} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.timelineText}>
              <Text style={[styles.timelineLabel, { color: ONBOARDING_ORANGE }]}>
                {isYearly && trialDays != null
                  ? `In ${trialDays} Day${trialDays !== 1 ? "s" : ""} – Billing Starts`
                  : "Today – Billed Weekly"}
              </Text>
              <Text style={styles.timelineBody}>
                {isYearly && trialDays != null
                  ? `You'll be charged on ${billingDate} unless you cancel before.`
                  : `You'll be billed ${weeklyPkg?.product.priceString ?? "…"}/week. Cancel anytime.`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom: shared PaywallBottom — onPlanChange keeps timeline in sync */}
      <PaywallBottom
        annualPkg={annualPkg}
        weeklyPkg={weeklyPkg}
        onPurchase={onPurchase}
        onRestore={onRestore}
        isPurchasing={isPurchasing}
        isRestoring={isRestoring}
        defaultPlan={plan}
        onPlanChange={setPlan}
      />
    </View>
  );
}

/* ── Paywall container — manages page flow + RevenueCat integration ── */
export function Paywall({ onComplete }: { onComplete: () => void }) {
  const [page, setPage] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const queryClient = useQueryClient();
  const { offerings, purchasePackage, restore, isPurchasing, isRestoring } = useSubscription();

  // Lazy init: only call Purchases.configure() when the user actually reaches
  // the onboarding paywall. The rcInitialized guard makes this safe to call
  // on every mount. Invalidate RC queries so any cached null values are
  // refetched now that the SDK is ready.
  useEffect(() => {
    initializeRevenueCat();
    void queryClient.invalidateQueries({ queryKey: ["revenuecat"] });
  }, [queryClient]);

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
      await purchasePackage(pkg);
      onComplete();
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
      {page === 0 && (
        <PageA
          onContinue={() => goPage(1)}
          onRestore={() => { void handleRestore(); }}
          isRestoring={isRestoring}
        />
      )}
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
  pageCTop: {
    flex: 1,
    justifyContent: "flex-start",
    gap: 12,
  },
  pageCTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    letterSpacing: -0.5,
    lineHeight: 36,
    textAlign: "center",
  },

  /* Page C — timeline */
  timeline: {
    gap: 0,
    paddingTop: 4,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 4,
  },
  timelineIconWrap: {
    alignItems: "center",
    width: 36,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 4,
    alignSelf: "center",
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

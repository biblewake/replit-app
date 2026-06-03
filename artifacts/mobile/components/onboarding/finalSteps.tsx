import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { OL, ONBOARDING_ORANGE } from "@/components/onboarding/primitives";

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
  const { signInWithGoogle, signInWithApple, session } = useAuth();
  const [busy, setBusy] = useState<null | "google" | "apple">(null);

  useEffect(() => {
    if (session) onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

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
        {/* Apple — black, shown first on non-Android */}
        {Platform.OS !== "android" ? (
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

      <Pressable onPress={onContinue} style={styles.skipBtn} hitSlop={10}>
        <Text style={[styles.skipText, { color: OL.mutedForeground }]}>
          Maybe later
        </Text>
      </Pressable>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Paywall — step 30. Three pages with plan toggle on Page C.
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

/* Page A — "We want you to try 'Bible Wake' for free." */
function PageA({ onNext }: { onNext: () => void }) {
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
        <View style={styles.noPay}>
          <Ionicons name="checkmark" size={16} color={OL.foreground} />
          <Text style={styles.noPayText}>No Payment Due Now</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onNext();
          }}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: ONBOARDING_ORANGE, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>Try For $0.00</Text>
        </Pressable>
        <Text style={styles.noCommit}>No commitment, cancel anytime.</Text>
        <View style={styles.linksRow}>
          <LinkText label="Privacy Policy" onPress={openPrivacy} />
          <Text style={styles.linkDot}>·</Text>
          <LinkText label="Restore Purchase" onPress={() => {}} />
          <Text style={styles.linkDot}>·</Text>
          <LinkText label="Terms of Use" onPress={openTerms} />
        </View>
      </View>
    </View>
  );
}

/* Page B — Reminder bell with notification image */
function PageB({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.pageWrap}>
      <View style={[styles.pageHero, { gap: 20 }]}>
        <Text style={styles.pageBTitle}>
          We&apos;ll send you a{"\n"}reminder before your{"\n"}free trial ends
        </Text>
        <Image
          source={require("../../assets/images/notification.png")}
          style={styles.pageBImage}
          resizeMode="contain"
        />
        <Text style={styles.pageBBody}>
          We&apos;ll send you a reminder before your trial ends. No surprise charges.
        </Text>
      </View>

      <View style={styles.pageFooter}>
        <View style={styles.noPay}>
          <Ionicons name="checkmark" size={16} color={OL.foreground} />
          <Text style={styles.noPayText}>No Payment Due Now</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onNext();
          }}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: ONBOARDING_ORANGE, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>Continue For Free</Text>
        </Pressable>
        <Text style={styles.pricingNote}>$39.99 per year ($0.76/week)</Text>
      </View>
    </View>
  );
}

/* Page C — How your free trial works, with plan toggle */
type Plan = "yearly" | "weekly";

function futureDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PageC({ onComplete }: { onComplete: () => void }) {
  const [plan, setPlan] = useState<Plan>("yearly");
  const isYearly = plan === "yearly";

  const selectPlan = (p: Plan) => {
    Haptics.selectionAsync();
    setPlan(p);
  };

  const billingDate = futureDateStr(isYearly ? 3 : 0);

  return (
    <View style={styles.pageWrap}>
      {/* Top: title + timeline, centered vertically */}
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
                {isYearly ? "In 2 Days – Reminder" : "Today"}
              </Text>
              <Text style={styles.timelineBody}>
                {isYearly
                  ? "We'll send you a reminder that your trial is ending soon."
                  : "Payment of $6.99 will be charged today."}
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
                {isYearly ? "In 3 Days – Billing Starts" : "Today – Billed Weekly"}
              </Text>
              <Text style={styles.timelineBody}>
                {isYearly
                  ? `You'll be charged on ${billingDate} unless you cancel before.`
                  : "You'll be billed $6.99/week. Cancel anytime."}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom: plan toggle + CTA */}
      <View style={styles.pageCBottom}>
        {/* Horizontal plan toggle — side by side */}
        <View style={styles.planToggle}>
          {/* Weekly option (left) */}
          <Pressable
            onPress={() => selectPlan("weekly")}
            style={[
              styles.planOption,
              { flex: 1, marginTop: 12 },
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
                <Text style={[styles.planPriceBold, { color: OL.foreground }]}>$6.99/week</Text>
              </View>
            </View>
          </Pressable>

          {/* Yearly option (right) */}
          <Pressable
            onPress={() => selectPlan("yearly")}
            style={[
              styles.planOption,
              { flex: 1, marginTop: 12 },
              isYearly
                ? { borderColor: ONBOARDING_ORANGE, backgroundColor: `${ONBOARDING_ORANGE}12` }
                : { borderColor: OL.border },
            ]}
          >
            {/* "3-day free trial" badge overlapping top border */}
            <View style={styles.trialTagWrap}>
              <View
                style={[
                  styles.trialTag,
                  { backgroundColor: isYearly ? ONBOARDING_ORANGE : OL.card, borderColor: isYearly ? ONBOARDING_ORANGE : OL.border, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.trialTagText, { color: isYearly ? "#FFFFFF" : OL.mutedForeground }]}>
                  3-day free trial
                </Text>
              </View>
            </View>
            <View style={styles.planRow}>
              <View style={[styles.planRadio, { borderColor: isYearly ? ONBOARDING_ORANGE : OL.border }]}>
                {isYearly ? <View style={[styles.planRadioDot, { backgroundColor: ONBOARDING_ORANGE }]} /> : null}
              </View>
              <View>
                <Text style={[styles.planName, { color: OL.mutedForeground }]}>Yearly</Text>
                <Text style={[styles.planPriceBold, { color: OL.foreground }]}>$0.76/week</Text>
              </View>
            </View>
          </Pressable>
        </View>

        {isYearly ? (
          <View style={styles.noPay}>
            <Ionicons name="checkmark" size={16} color={OL.foreground} />
            <Text style={styles.noPayText}>No Payment Due Now</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onComplete();
          }}
          style={({ pressed }) => [
            styles.ctaBtn,
            { backgroundColor: ONBOARDING_ORANGE, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={styles.ctaText}>
            {isYearly ? "Try for $0.00  →" : "Get Started"}
          </Text>
        </Pressable>

        <View style={styles.linksRow}>
          <LinkText label="Terms" onPress={openTerms} />
          <Text style={styles.linkDot}>·</Text>
          <LinkText label="Privacy Policy" onPress={openPrivacy} />
          <Text style={styles.linkDot}>·</Text>
          <LinkText label="Restore" onPress={() => {}} />
        </View>
      </View>
    </View>
  );
}

export function Paywall({ onComplete }: { onComplete: () => void }) {
  const [page, setPage] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const goPage = (next: number) => {
    Haptics.selectionAsync();
    Animated.sequence([
      Animated.timing(fade, { toValue: 0, duration: 130, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
    setPage(next);
  };

  return (
    <Animated.View style={[styles.paywallWrap, { opacity: fade }]}>
      {page === 0 && <PageA onNext={() => goPage(1)} />}
      {page === 1 && <PageB onNext={() => goPage(2)} />}
      {page === 2 && <PageC onComplete={onComplete} />}
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
  skipBtn: {
    alignSelf: "center",
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
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
  pageCBottom: {
    gap: 10,
    paddingTop: 4,
  },
  pageCTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    letterSpacing: -0.5,
    lineHeight: 36,
    textAlign: "center",
  },
  /* Horizontal plan toggle */
  planToggle: {
    flexDirection: "row",
    gap: 10,
  },
  planOption: {
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
  planPrice: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  planPriceBold: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginTop: 1,
  },
  /* Trial tag overlapping top border */
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

  /* Shared CTA + footer */
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
});

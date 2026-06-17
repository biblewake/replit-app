import React, { useEffect, useRef, useState } from "react";
import {
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
import { ActivityIndicator } from "react-native";

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
 * Paywall — step 30. Stub: completes immediately since subscription is
 * always granted by the stub provider.
 * ────────────────────────────────────────────────────────────────────────── */
export function Paywall({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    onComplete();
  }, [onComplete]);

  return <View style={styles.paywallWrap} />;
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
  /* Paywall */
  paywallWrap: {
    flex: 1,
  },
});

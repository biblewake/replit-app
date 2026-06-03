import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

/** Bible Wake onboarding accent color. */
export const ONBOARDING_ORANGE = "#FF9000";

/** Forced light-mode colors used throughout onboarding (ignores system theme). */
export const OL = {
  background: "#FFFFFF",
  foreground: "#1C1C1E",
  mutedForeground: "#8E8E93",
  border: "#E5E5EA",
  card: "#F2F2F7",
  secondary: "#F2F2F7",
};

const USE_NATIVE_DRIVER = Platform.OS !== "web";

/* ──────────────────────────────────────────────────────────────────────────
 * ProgressBar — thin top bar with an animated #FF9000 fill.
 * ────────────────────────────────────────────────────────────────────────── */
export function ProgressBar({ progress }: { progress: number }) {
  const widthAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.progressTrack, { backgroundColor: OL.border }]}>
      <Animated.View
        style={[styles.progressFill, { width, backgroundColor: ONBOARDING_ORANGE }]}
      />
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * StepQuestion — large bold title + optional subtitle.
 * ────────────────────────────────────────────────────────────────────────── */
export function StepQuestion({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.questionHeader}>
      <Text style={[styles.questionTitle, { color: OL.foreground }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.questionSubtitle, { color: OL.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * SelectionCard — a pill/card row with an orange checkmark circle.
 * ────────────────────────────────────────────────────────────────────────── */
export function SelectionCard({
  label,
  selected,
  index,
  onPress,
}: {
  label: string;
  selected: boolean;
  index?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.selectionCard,
        {
          backgroundColor: OL.card,
          borderColor: selected ? ONBOARDING_ORANGE : OL.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.selectionCircle,
          {
            backgroundColor: selected ? ONBOARDING_ORANGE : "transparent",
            borderColor: selected ? ONBOARDING_ORANGE : OL.border,
          },
        ]}
      >
        {selected ? (
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        ) : index != null ? (
          <Text style={[styles.selectionIndex, { color: OL.mutedForeground }]}>
            {index}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.selectionLabel,
          {
            color: OL.foreground,
            fontFamily: selected ? "Inter_600SemiBold" : "Inter_500Medium",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * InsightScreen — centered title + body + optional graphic slot.
 * statLabel renders as a plain grey subheading (no orange pill).
 * ────────────────────────────────────────────────────────────────────────── */
export function InsightScreen({
  title,
  body,
  emoji,
  statLabel,
  children,
}: {
  title: string;
  body?: string;
  emoji?: string;
  statLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.insightWrap}>
      {emoji ? <Text style={styles.insightEmoji}>{emoji}</Text> : null}
      <Text style={[styles.insightTitle, { color: OL.foreground }]}>
        {title}
      </Text>
      {children ? <View style={styles.insightGraphic}>{children}</View> : null}
      {body ? (
        <Text style={[styles.insightBody, { color: OL.mutedForeground }]}>
          {body}
        </Text>
      ) : null}
      {statLabel ? (
        <Text style={[styles.statText, { color: OL.mutedForeground }]}>
          {statLabel}
        </Text>
      ) : null}
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ContinueButton — full-width orange pill.
 * ────────────────────────────────────────────────────────────────────────── */
export function ContinueButton({
  label = "Continue",
  disabled,
  onPress,
  color,
}: {
  label?: string;
  disabled?: boolean;
  onPress: () => void;
  color?: string;
}) {
  const activeColor = color ?? ONBOARDING_ORANGE;
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.continueBtn,
        {
          backgroundColor: disabled ? "#C9C9CE" : activeColor,
          opacity: pressed && !disabled ? 0.88 : 1,
        },
      ]}
    >
      <Text style={styles.continueBtnText}>{label}</Text>
    </Pressable>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * BackArrow — top-left back chevron.
 * ────────────────────────────────────────────────────────────────────────── */
export function BackArrow({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      hitSlop={12}
      style={styles.backArrow}
    >
      <Ionicons name="chevron-back" size={26} color={OL.foreground} />
    </Pressable>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * FadeIn — quick fade-in wrapper.
 * ────────────────────────────────────────────────────────────────────────── */
export function FadeIn({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [opacity]);
  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  questionHeader: {
    marginBottom: 24,
    gap: 8,
  },
  questionTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  questionSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  selectionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  selectionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionIndex: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  selectionLabel: {
    fontSize: 16,
    flex: 1,
  },
  insightWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 8,
  },
  insightEmoji: {
    fontSize: 64,
  },
  insightTitle: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    textAlign: "center",
    lineHeight: 32,
  },
  insightGraphic: {
    width: "100%",
    alignItems: "center",
  },
  insightBody: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  statText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  continueBtn: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  continueBtnText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  backArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});

import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import * as StoreReview from "expo-store-review";
import { Camera } from "expo-camera";
import { OL, ONBOARDING_ORANGE } from "@/components/onboarding/primitives";

export type PermissionKind = "notifications" | "alarm" | "camera" | "review";

interface PermissionConfig {
  image?: ReturnType<typeof require>;
  title: string;
  body: string;
  cta: string;
}

const CONFIG: Record<PermissionKind, PermissionConfig> = {
  notifications: {
    image: require("../../assets/images/notification.png"),
    title: "Never miss your wake-up",
    body: "Allow notifications so your Scripture alarms can reach you every morning, right on time.",
    cta: "Enable notifications",
  },
  alarm: {
    image: require("../../assets/images/alarm-clock.png"),
    title: "Wake up on time, every time",
    body: "Breaks through Sleep and Focus modes so your morning Scripture alarm always reaches you.",
    cta: "Allow alarm sounds",
  },
  camera: {
    image: require("../../assets/images/camera.png"),
    title: "Prove you're awake",
    body: "Bible Wake uses your camera to confirm you are awake and present while reciting your verse.",
    cta: "Enable camera",
  },
  review: {
    title: "Enjoying what you see?",
    body: "Bible Wake is built by a small team of believers. A quick rating helps more people start their mornings with Scripture.",
    cta: "Rate Bible Wake",
  },
};

export function PermissionScreen({
  kind,
  onContinue,
}: {
  kind: PermissionKind;
  onContinue: () => void;
}) {
  const cfg = CONFIG[kind];
  const [busy, setBusy] = useState(false);

  const request = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      if (kind === "notifications" || kind === "alarm") {
        await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
      } else if (kind === "camera") {
        await Camera.requestCameraPermissionsAsync();
      } else if (kind === "review") {
        if (await StoreReview.isAvailableAsync()) {
          await StoreReview.requestReview();
        }
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false);
      onContinue();
    }
  };

  return (
    <View style={styles.wrap}>
      {/* Content pushed to top, actions pinned to bottom */}
      <View style={styles.body}>
        {cfg.image ? (
          <Image source={cfg.image} style={styles.icon} resizeMode="contain" />
        ) : null}
        <Text style={[styles.title, { color: OL.foreground }]}>{cfg.title}</Text>
        <Text style={[styles.bodyText, { color: OL.mutedForeground }]}>{cfg.body}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          disabled={busy}
          onPress={request}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: ONBOARDING_ORANGE, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text style={styles.primaryBtnText}>{cfg.cta}</Text>
        </Pressable>
        {kind === "review" ? (
          <Pressable onPress={onContinue} hitSlop={10} style={styles.skip}>
            <Text style={[styles.skipText, { color: OL.mutedForeground }]}>
              Maybe later
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "space-between",
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 8,
  },
  icon: {
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  bodyText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 23,
    maxWidth: 330,
  },
  actions: {
    gap: 14,
    paddingTop: 8,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  skip: {
    alignSelf: "center",
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});

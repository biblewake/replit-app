import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as IntentLauncher from "expo-intent-launcher";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const USE_NATIVE_DRIVER = Platform.OS !== "web";

export type AlarmPermissionType = "notification" | "exactAlarm";

interface AlarmPermissionSheetProps {
  visible: boolean;
  onClose: () => void;
  permissionType?: AlarmPermissionType;
}

const CONTENT: Record<
  AlarmPermissionType,
  { title: string; subtitle: string; buttonLabel: string }
> = {
  notification: {
    title: "Alarm Access Denied",
    subtitle:
      "Bible Wake needs notification permission to ring your alarms. Without it, alarms you set will never fire.",
    buttonLabel: "Open Settings",
  },
  exactAlarm: {
    title: "Exact Alarms Disabled",
    subtitle:
      'Bible Wake needs permission to schedule exact alarms. Without it, your alarms may fire late or not at all. Tap below to open "Alarms & reminders" and enable it for Bible Wake.',
    buttonLabel: "Open Alarm Settings",
  },
};

export default function AlarmPermissionSheet({
  visible,
  onClose,
  permissionType = "notification",
}: AlarmPermissionSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const { title, subtitle, buttonLabel } = CONTENT[permissionType];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.poly(4)),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [visible]);

  const handleOpenSettings = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (permissionType === "exactAlarm" && Platform.OS === "android") {
      try {
        await IntentLauncher.startActivityAsync(
          "android.settings.REQUEST_SCHEDULE_EXACT_ALARM"
        );
      } catch {
        Linking.openSettings();
      }
    } else {
      Linking.openSettings();
    }
  };

  const handleMaybeLater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const sheetHeight = permissionType === "exactAlarm" ? 460 + insets.bottom : 420 + insets.bottom;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="none"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: colors.card,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.grabber} />

          <View style={styles.closeRow}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              }}
              hitSlop={10}
            >
              <BlurView intensity={65} tint="light" style={styles.glassClose}>
                <Ionicons name="close" size={14} color="rgba(0,0,0,0.6)" />
              </BlurView>
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={[styles.iconCircle, { backgroundColor: "#FF3B3015" }]}>
              <Image
                source={require("@/assets/images/alarm_icon.png")}
                style={styles.iconImg}
                resizeMode="contain"
              />
            </View>

            <Text style={[styles.title, { color: colors.foreground }]}>
              {title}
            </Text>

            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {subtitle}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.settingsBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleOpenSettings}
            >
              <Ionicons name="settings-outline" size={18} color="#fff" />
              <Text style={styles.settingsBtnText}>{buttonLabel}</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.laterBtn,
                {
                  backgroundColor: pressed ? colors.border : colors.secondary,
                },
              ]}
              onPress={handleMaybeLater}
            >
              <Text style={[styles.laterBtnText, { color: colors.mutedForeground }]}>
                Maybe Later
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    elevation: 24,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D1D6",
    alignSelf: "center",
    marginBottom: 4,
  },
  closeRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: "flex-start",
  },
  glassClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconImg: {
    width: 38,
    height: 38,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1C1C1E",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    marginTop: 8,
  },
  settingsBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  laterBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  laterBtnText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});

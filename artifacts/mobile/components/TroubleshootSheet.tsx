import React from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import BottomSheet from "@/components/BottomSheet";
import { useColors } from "@/hooks/useColors";

interface TroubleshootSheetProps {
  visible: boolean;
  onClose: () => void;
}

function Card({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

function CardTitle({
  icon,
  label,
  iconColor,
  colors,
}: {
  icon: string;
  label: string;
  iconColor: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.cardTitleRow}>
      <Ionicons name={icon as any} size={18} color={iconColor} />
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>
        {label}
      </Text>
    </View>
  );
}

function PermissionRow({
  icon,
  label,
  colors,
}: {
  icon: string;
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.permRow}>
      <View style={[styles.permIconWrap, { backgroundColor: "#FF950022" }]}>
        <Ionicons name={icon as any} size={16} color="#FF9500" />
      </View>
      <Text style={[styles.permLabel, { color: colors.foreground }]}>
        {label}
      </Text>
    </View>
  );
}

function BulletRow({
  text,
  colors,
}: {
  text: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color: colors.mutedForeground }]}>
        •
      </Text>
      <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>
        {text}
      </Text>
    </View>
  );
}

export default function TroubleshootSheet({
  visible,
  onClose,
}: TroubleshootSheetProps) {
  const colors = useColors();

  const openAppSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL("app-settings:");
  };

  const openSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL("mailto:support@trybiblewake.com");
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height="auto" showCloseButton={false}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onClose();
          }}
          hitSlop={4}
        >
          <BlurView intensity={65} tint="light" style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="rgba(0,0,0,0.55)" />
          </BlurView>
        </Pressable>
        <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
          Alarm Troubleshooting
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card colors={colors}>
          <CardTitle
            icon="volume-high-outline"
            label="Check Your Volume"
            iconColor="#FF9500"
            colors={colors}
          />
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Bible Wake uses a volume automation to ensure the alarm is audible. Follow these steps to verify your volume is set correctly:
          </Text>
          {[
            "Open iOS Settings",
            'Tap "Sounds & Haptics"',
            'Under "Ringer & Alerts", drag the slider to full volume',
            'Disable "Change with Buttons" so buttons don\'t lower the ringer',
            "Return to Bible Wake and set a test alarm 1 minute from now",
            "Lock your phone and wait",
            "The alarm should sound at full volume",
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: colors.border }]}>
                <Text style={[styles.stepNumText, { color: colors.foreground }]}>
                  {i + 1}
                </Text>
              </View>
              <Text style={[styles.stepText, { color: colors.foreground }]}>
                {step}
              </Text>
            </View>
          ))}
        </Card>

        <Card colors={colors}>
          <CardTitle
            icon="shield-checkmark-outline"
            label="Permissions"
            iconColor="#FF9500"
            colors={colors}
          />
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            Bible Wake needs the following permissions to fire alarms reliably:
          </Text>
          <PermissionRow
            icon="alarm-outline"
            label="Alarms & Reminders"
            colors={colors}
          />
          <PermissionRow
            icon="notifications-outline"
            label="Notifications"
            colors={colors}
          />
          <PermissionRow
            icon="camera-outline"
            label="Camera (Wake-up Check)"
            colors={colors}
          />
          <PermissionRow
            icon="mic-outline"
            label="Microphone (Wake-up Check)"
            colors={colors}
          />
          <Pressable
            onPress={openAppSettings}
            style={({ pressed }) => [
              styles.settingsBtn,
              {
                backgroundColor: pressed ? colors.border : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name="settings-outline"
              size={16}
              color={colors.foreground}
            />
            <Text style={[styles.settingsBtnText, { color: colors.foreground }]}>
              Open App Settings
            </Text>
          </Pressable>
        </Card>

        <Card colors={colors}>
          <CardTitle
            icon="information-circle-outline"
            label="How the Alarm Works"
            iconColor="#007AFF"
            colors={colors}
          />
          <BulletRow
            text="Bible Wake schedules alarms using iOS local notifications with a critical-alert sound."
            colors={colors}
          />
          <BulletRow
            text="The app must have notification permission granted to deliver alarms."
            colors={colors}
          />
          <BulletRow
            text="Do Not Disturb and Focus modes can silence alarms — check your Focus settings."
            colors={colors}
          />
          <BulletRow
            text="Low Power Mode does not affect alarms, but Background App Refresh should be enabled."
            colors={colors}
          />
        </Card>

        <Card colors={colors}>
          <CardTitle
            icon="help-circle-outline"
            label="Still Not Working?"
            iconColor="#FF3B30"
            colors={colors}
          />
          <Text style={[styles.cardBody, { color: colors.mutedForeground }]}>
            If you've tried everything above and your alarm still isn't firing, reach out and we'll help you get it sorted.
          </Text>
          <Pressable
            onPress={openSupport}
            style={({ pressed }) => [
              styles.supportBtn,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="mail-outline" size={16} color="#fff" />
            <Text style={styles.supportBtnText}>Contact Support</Text>
          </Pressable>
        </Card>

        <View style={{ height: 32 }} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
  },
  sheetTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cardBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 2,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  stepNumText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  stepText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    flex: 1,
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  permIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  permLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  settingsBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 20,
  },
  bulletText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    flex: 1,
  },
  supportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  supportBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});

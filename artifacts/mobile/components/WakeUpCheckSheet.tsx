import React from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import BottomSheet from "@/components/BottomSheet";

interface FeatureRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
}

function FeatureRow({ icon, iconColor, iconBg, title, subtitle }: FeatureRowProps) {
  const colors = useColors();
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.featureSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

interface WakeUpCheckSheetProps {
  visible: boolean;
  onClose: () => void;
  enabled: boolean;
  onToggle: (val: boolean) => void;
}

export default function WakeUpCheckSheet({
  visible,
  onClose,
  enabled,
  onToggle,
}: WakeUpCheckSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet visible={visible} onClose={onClose} height={520}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Wake-up Check</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Confirm you're truly awake with a brief challenge before your alarm silences.
          </Text>
        </View>

        <View style={styles.features}>
          <FeatureRow
            icon="flash"
            iconColor="#FF6B00"
            iconBg="#FF6B0015"
            title="Mental Challenge"
            subtitle="Answer a simple question to prove you're awake"
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <FeatureRow
            icon="shield-checkmark"
            iconColor="#34C759"
            iconBg="#34C75915"
            title="Snooze Protection"
            subtitle="Prevents accidental dismissal while still half-asleep"
          />
        </View>

        <Pressable
          style={[styles.toggleRow, { backgroundColor: colors.secondary }]}
          onPress={() => {
            Haptics.selectionAsync();
            onToggle(!enabled);
          }}
        >
          <View style={styles.toggleLabel}>
            <Ionicons name="checkmark-circle" size={20} color={enabled ? colors.success : colors.mutedForeground} />
            <Text style={[styles.toggleText, { color: colors.foreground }]}>Enable Wake-up Check</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={(val) => {
              Haptics.selectionAsync();
              onToggle(val);
            }}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor="#fff"
          />
        </Pressable>

        <Pressable
          style={[styles.doneBtn, { marginBottom: Math.max(insets.bottom, 16) + 4 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onClose();
          }}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  features: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
  },
  featureIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  toggleLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  doneBtn: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});

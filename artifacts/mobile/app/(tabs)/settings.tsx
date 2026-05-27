import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
}

function SettingsRow({
  icon,
  label,
  subtitle,
  trailing,
  isFirst,
  isLast,
  onPress,
  colors,
}: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed && onPress ? colors.secondary : colors.card,
          borderTopLeftRadius: isFirst ? 16 : 0,
          borderTopRightRadius: isFirst ? 16 : 0,
          borderBottomLeftRadius: isLast ? 16 : 0,
          borderBottomRightRadius: isLast ? 16 : 0,
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.rowLeft}>
        <View style={styles.iconWrap}>{icon}</View>
        <View style={styles.labelWrap}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>
            {label}
          </Text>
          {subtitle ? (
            <Text
              style={[styles.rowSubtitle, { color: colors.mutedForeground }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {trailing ? (
        trailing
      ) : onPress ? (
        <Ionicons
          name="chevron-forward"
          size={17}
          color={colors.mutedForeground}
        />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [darkMode, setDarkMode] = useState(false);

  const paddingTop = insets.top + (Platform.OS === "web" ? 67 : 16);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop, paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Settings
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Alarm
        </Text>
        <View style={[styles.group, { backgroundColor: colors.card }]}>
          <SettingsRow
            colors={colors}
            isFirst
            icon={
              <Ionicons
                name="settings-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Alarm Settings"
            onPress={() => {}}
          />
          <SettingsRow
            colors={colors}
            icon={
              <Ionicons
                name="volume-medium-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Alarm Volume"
            subtitle="iOS Settings → Sounds & Haptics → Ringer & Alerts"
            trailing={
              <Ionicons
                name="open-outline"
                size={17}
                color={colors.mutedForeground}
              />
            }
            onPress={() => {}}
          />
          <SettingsRow
            colors={colors}
            icon={
              <Ionicons
                name="warning-outline"
                size={20}
                color="#FF9500"
              />
            }
            label="Alarm not working?"
            onPress={() => {}}
          />
          <SettingsRow
            colors={colors}
            isLast
            icon={
              <MaterialCommunityIcons
                name="bug-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Report a Bug"
            onPress={() => {}}
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Preferences
        </Text>
        <View style={[styles.group, { backgroundColor: colors.card }]}>
          <SettingsRow
            colors={colors}
            isFirst
            icon={
              <Ionicons
                name="notifications-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Notifications"
            onPress={() => {}}
          />
          <SettingsRow
            colors={colors}
            icon={
              <Ionicons
                name="globe-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Language"
            trailing={
              <View style={styles.languageTrail}>
                <Text style={styles.flagEmoji}>🇺🇸</Text>
                <Text style={[styles.languageText, { color: colors.mutedForeground }]}>
                  English
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={colors.mutedForeground}
                />
              </View>
            }
            onPress={() => {}}
          />
          <SettingsRow
            colors={colors}
            isLast
            icon={
              <Ionicons
                name="sunny-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Dark Mode"
            trailing={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: colors.border, true: colors.foreground }}
                thumbColor="#fff"
              />
            }
          />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          About
        </Text>
        <View style={[styles.group, { backgroundColor: colors.card }]}>
          <SettingsRow
            colors={colors}
            isFirst
            icon={
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Version"
            trailing={
              <Text
                style={[styles.versionText, { color: colors.mutedForeground }]}
              >
                1.0.0
              </Text>
            }
          />
          <SettingsRow
            colors={colors}
            icon={
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Privacy Policy"
            onPress={() => {}}
          />
          <SettingsRow
            colors={colors}
            isLast
            icon={
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Terms of Service"
            onPress={() => {}}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 52,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  iconWrap: {
    width: 26,
    alignItems: "center",
  },
  labelWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  rowSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 16,
  },
  languageTrail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  flagEmoji: {
    fontSize: 16,
  },
  languageText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  versionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});

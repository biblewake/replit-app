import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/context/ThemeContext";
import TroubleshootSheet from "@/components/TroubleshootSheet";

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
  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

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
      onPress={handlePress}
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
  const { colorScheme, toggleColorScheme } = useTheme();
  const insets = useSafeAreaInsets();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [troubleshootVisible, setTroubleshootVisible] = useState(false);

  const paddingTop = insets.top + (Platform.OS === "web" ? 67 : 16);

  const openAppSettings = () => Linking.openURL("app-settings:");
  const openSupport = () =>
    Linking.openURL("mailto:support@trybiblewake.com");

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

        {/* Alarm */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Alarm
        </Text>
        <View
          style={[
            styles.group,
            { backgroundColor: colors.card, shadowColor: colors.foreground },
          ]}
        >
          <SettingsRow
            colors={colors}
            isFirst
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
            onPress={openAppSettings}
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
            onPress={() => setTroubleshootVisible(true)}
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
            onPress={openSupport}
          />
        </View>

        {/* Preferences */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Preferences
        </Text>
        <View
          style={[
            styles.group,
            { backgroundColor: colors.card, shadowColor: colors.foreground },
          ]}
        >
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
            trailing={
              <Switch
                value={notificationsEnabled}
                onValueChange={(v) => {
                  Haptics.selectionAsync();
                  setNotificationsEnabled(v);
                  if (v) {
                    openAppSettings();
                  }
                }}
                trackColor={{ false: colors.border, true: colors.blue }}
                thumbColor="#fff"
              />
            }
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
                value={colorScheme === "dark"}
                onValueChange={() => {
                  Haptics.selectionAsync();
                  toggleColorScheme();
                }}
                trackColor={{ false: colors.border, true: colors.blue }}
                thumbColor="#fff"
              />
            }
          />
        </View>
        {!notificationsEnabled && (
          <Text style={styles.notifWarning}>
            Enable notifications to receive alarms even when the app is closed.
          </Text>
        )}

        {/* About */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          About
        </Text>
        <View
          style={[
            styles.group,
            { backgroundColor: colors.card, shadowColor: colors.foreground },
          ]}
        >
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
            onPress={() =>
              Linking.openURL("https://trybiblewake.com/privacy-policy")
            }
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
            onPress={() => Linking.openURL("https://biblewake.com/terms")}
          />
        </View>

        {/* Subscription */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Subscription
        </Text>
        <View
          style={[
            styles.group,
            { backgroundColor: colors.card, shadowColor: colors.foreground },
          ]}
        >
          <SettingsRow
            colors={colors}
            isFirst
            icon={
              <Ionicons
                name="close-circle-outline"
                size={20}
                color={colors.destructive}
              />
            }
            label="Cancel Subscription"
            onPress={() => {
              Alert.alert(
                "Cancel Subscription",
                "This will take you to manage your subscription. Are you sure?",
                [
                  { text: "Not now", style: "cancel" },
                  {
                    text: "Continue",
                    style: "destructive",
                    onPress: () => {},
                  },
                ]
              );
            }}
          />
          <SettingsRow
            colors={colors}
            isLast
            icon={
              <Ionicons
                name="card-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Manage Subscription"
            onPress={() => {
              Alert.alert(
                "Manage Subscription",
                "Subscription management coming soon.",
                [{ text: "OK" }]
              );
            }}
          />
        </View>

        {/* Delete Account */}
        <Pressable
          style={({ pressed }) => [
            styles.deleteBtn,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            Alert.alert(
              "Delete Account",
              "This will permanently delete your account and all associated data. This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Account",
                  style: "destructive",
                  onPress: () => {
                    Alert.alert(
                      "Account Deletion",
                      "Account deletion is not yet available. Please contact support@trybiblewake.com for assistance.",
                      [{ text: "OK" }]
                    );
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.deleteBtnText}>Delete Account</Text>
        </Pressable>
      </ScrollView>

      <TroubleshootSheet
        visible={troubleshootVisible}
        onClose={() => setTroubleshootVisible(false)}
      />
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
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
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
  versionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  notifWarning: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#FF3B30",
    marginTop: 4,
    marginBottom: 16,
    marginLeft: 4,
    lineHeight: 16,
  },
  deleteBtn: {
    backgroundColor: "#FF3B30",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  deleteBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

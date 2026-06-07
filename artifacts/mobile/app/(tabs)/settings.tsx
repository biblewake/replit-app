import React, { useState } from "react";
import {
  Alert,
  ActivityIndicator,
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
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/hooks/useColors";
import { useIsNativeTabs } from "@/hooks/useIsNativeTabs";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/lib/revenuecat";
import { supabase } from "@/lib/supabase";
import { requestBatteryOptimizationExemption } from "@/lib/batteryOptimization";
import TroubleshootSheet from "@/components/TroubleshootSheet";
import BottomSheet from "@/components/BottomSheet";

const TRANSLATION_OPTIONS = ["NIV", "ESV", "KJV", "NKJV", "NLT", "CSB", "AMP"];
const TRANSLATION_STORAGE_KEY = "@bible_wake_preferred_translation";

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
  destructive?: boolean;
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
  destructive,
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
          <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>
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

function openSubscriptionManagement(managementURL: string | undefined | null) {
  const fallback =
    Platform.OS === "android"
      ? "https://play.google.com/store/account/subscriptions"
      : "https://apps.apple.com/account/subscriptions";
  const url = managementURL ?? fallback;
  Linking.openURL(url).catch(() => {
    Alert.alert("Unable to open", "Please manage your subscription in the App Store.");
  });
}

export default function SettingsScreen() {
  const colors = useColors();
  const { signOut, profile, updateProfile, user } = useAuth();
  const { customerInfo } = useSubscription();
  const insets = useSafeAreaInsets();
  const isNativeTabs = useIsNativeTabs();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [troubleshootVisible, setTroubleshootVisible] = useState(false);
  const [translationSheetVisible, setTranslationSheetVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const paddingTop = insets.top + (Platform.OS === "web" ? 67 : 16);

  // Determine current translation: from profile if logged in, fallback to AsyncStorage default
  const [localTranslation, setLocalTranslation] = useState<string | null>(null);
  const currentTranslation = profile?.preferred_translation ?? localTranslation ?? "NIV";

  // Load local translation for guest users on mount
  React.useEffect(() => {
    if (!user) {
      AsyncStorage.getItem(TRANSLATION_STORAGE_KEY)
        .then((val) => { if (val) setLocalTranslation(val); })
        .catch(() => {});
    }
  }, [user]);

  const handleSelectTranslation = async (translation: string) => {
    setTranslationSheetVisible(false);
    if (user) {
      await updateProfile({ preferred_translation: translation });
    } else {
      setLocalTranslation(translation);
      AsyncStorage.setItem(TRANSLATION_STORAGE_KEY, translation).catch(() => {});
    }
  };

  const openAppSettings = () => Linking.openURL("app-settings:");
  const openSupport = () =>
    Linking.openURL("mailto:support@trybiblewake.com");

  const handleBatteryOptimization = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    requestBatteryOptimizationExemption();
  };

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => signOut(),
      },
    ]);
  };

  const handleManageSubscription = () => {
    openSubscriptionManagement(customerInfo?.managementURL);
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      "Cancel Subscription",
      "This will take you to manage your subscription in the App Store where you can cancel.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => openSubscriptionManagement(customerInfo?.managementURL),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "This Cannot Be Undone",
              "This will permanently delete all your data including alarms, wake history, verse stats, and streaks. This cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Forever",
                  style: "destructive",
                  onPress: performAccountDeletion,
                },
              ]
            );
          },
        },
      ]
    );
  };

  const performAccountDeletion = async () => {
    if (!user) {
      Alert.alert("Not signed in", "You must be signed in to delete your account.");
      return;
    }
    setDeletingAccount(true);
    try {
      // delete_user() RPC deletes all user rows + auth.users in one atomic server-side call
      const { error } = await supabase.rpc("delete_user");
      if (error) throw error;
      await supabase.auth.signOut();
    } catch (err) {
      setDeletingAccount(false);
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      Alert.alert(
        "Deletion Failed",
        `Could not delete your account: ${message}\n\nPlease contact support@trybiblewake.com.`
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {deletingAccount && (
        <View style={styles.deletingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.deletingText}>Deleting account…</Text>
        </View>
      )}

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
          {Platform.OS === "android" && (
            <SettingsRow
              colors={colors}
              icon={
                <Ionicons
                  name="battery-charging-outline"
                  size={20}
                  color="#34C759"
                />
              }
              label="Allow Background Activity"
              subtitle="Prevents Samsung, Xiaomi & other OEMs from killing alarms when you swipe the app away"
              onPress={handleBatteryOptimization}
            />
          )}
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
        {Platform.OS === "android" && (
          <Text style={[styles.androidBatteryNote, { color: colors.mutedForeground }]}>
            On Samsung, Xiaomi, OnePlus, and Huawei devices, swiping Bible Wake from recents can cancel scheduled alarms. Tap "Allow Background Activity" above to prevent this.
          </Text>
        )}

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
                name="book-outline"
                size={20}
                color={colors.foreground}
              />
            }
            label="Bible Translation"
            trailing={
              <View style={styles.translationTrailing}>
                <Text style={[styles.translationValue, { color: colors.mutedForeground }]}>
                  {currentTranslation}
                </Text>
                <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
              </View>
            }
            onPress={() => setTranslationSheetVisible(true)}
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
            onPress={handleCancelSubscription}
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
            onPress={handleManageSubscription}
          />
        </View>

        {/* Account */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Account
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
            isLast
            destructive
            icon={
              <Ionicons
                name="trash-outline"
                size={20}
                color={colors.destructive}
              />
            }
            label="Delete Account"
            onPress={handleDeleteAccount}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleSignOut}
        >
          <Text style={[styles.logoutBtnText, { color: colors.foreground }]}>Log Out</Text>
        </Pressable>
      </ScrollView>

      <TroubleshootSheet
        visible={troubleshootVisible}
        onClose={() => setTroubleshootVisible(false)}
      />

      {/* Bible Translation Picker Sheet */}
      <BottomSheet
        visible={translationSheetVisible}
        onClose={() => setTranslationSheetVisible(false)}
        height="auto"
        showCloseButton={false}
      >
        <View style={styles.translationSheet}>
          <Text style={[styles.translationSheetTitle, { color: colors.foreground }]}>
            Bible Translation
          </Text>
          {TRANSLATION_OPTIONS.map((option, idx) => (
            <Pressable
              key={option}
              style={({ pressed }) => [
                styles.translationOption,
                {
                  backgroundColor: pressed ? colors.secondary : "transparent",
                  borderBottomWidth: idx < TRANSLATION_OPTIONS.length - 1 ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={() => handleSelectTranslation(option)}
            >
              <Text style={[styles.translationOptionText, { color: colors.foreground }]}>
                {option}
              </Text>
              {currentTranslation === option && (
                <Ionicons name="checkmark" size={20} color={colors.accent} />
              )}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
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
    marginTop: -16,
    marginBottom: 16,
    marginLeft: 4,
    lineHeight: 16,
  },
  androidBatteryNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: -16,
    marginBottom: 16,
    marginLeft: 4,
    lineHeight: 16,
  },
  translationTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  translationValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  logoutBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(142,142,147,0.3)",
  },
  logoutBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  deletingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    gap: 16,
  },
  deletingText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  translationSheet: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 40,
  },
  translationSheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  translationOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  translationOptionText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
});

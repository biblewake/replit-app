import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useIsNativeTabs } from "@/hooks/useIsNativeTabs";
import { useAlarms } from "@/context/AlarmContext";
import { useAlarmPermission } from "@/hooks/useAlarmPermission";
import { useAuth } from "@/context/AuthContext";
import WeekDots from "@/components/WeekDots";
import AlarmEditSheet from "@/components/AlarmEditSheet";
import VerseCard from "@/components/VerseCard";
import { BIBLE_VERSES } from "@/constants/verses";
import { getSoundById } from "@/constants/alarmSounds";
import { supabase } from "@/lib/supabase";

interface TodayVerseState {
  ref: string;
  text: string;
  backgroundImageUrl?: string | null;
  found: boolean;
}

function formatTime(hour: number, minute: number, isPM: boolean): string {
  const h = hour === 0 ? 12 : hour;
  const m = minute.toString().padStart(2, "0");
  return `${h}:${m}`;
}

function getAmPm(isPM: boolean) {
  return isPM ? "pm" : "am";
}

function getRingsIn(hour: number, minute: number, isPM: boolean): string {
  const now = new Date();
  const alarmHour24 = isPM
    ? hour === 12 ? 12 : hour + 12
    : hour === 12 ? 0 : hour;
  const alarmMins = alarmHour24 * 60 + minute;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let diff = alarmMins - nowMins;
  if (diff <= 0) diff += 1440;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `Rings in ${m}m`;
  return `Rings in ${h}h ${m}m`;
}

function getDayName(dayIndex: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[dayIndex];
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isNativeTabs = useIsNativeTabs();
  const { alarms, toggleAlarm, addAlarm, updateAlarm, streak, getNextAlarm } = useAlarms();
  const { hasPermission, hasExactAlarmPermission, alarmKitAuthorized } = useAlarmPermission();
  const allPermissionsGranted =
    hasPermission &&
    hasExactAlarmPermission &&
    (Platform.OS !== "ios" || alarmKitAuthorized);
  const { user, profile } = useAuth();
  const [showAddAlarm, setShowAddAlarm] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<import("@/context/AlarmContext").Alarm | null>(null);
  const [todayVerse, setTodayVerse] = useState<TodayVerseState | null>(null);

  const todayIndex = new Date().getDay();
  const nextAlarm = getNextAlarm();
  const nextScheduledVerseAlarm = nextAlarm;

  // Derive sound name from the next alarm's soundId
  const alarmSoundName = nextAlarm?.soundId
    ? (getSoundById(nextAlarm.soundId)?.label ?? "Custom")
    : "Default";

  // Fetch today's successfully recited verse — runs on mount and every time the tab gains focus
  const fetchTodayVerse = useCallback(async () => {
    if (!user) {
      setTodayVerse({ ref: "", text: "", found: false });
      return;
    }
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data } = await supabase
        .from("wake_history")
        .select("verse_ref, verse_text, verse_background_image_id")
        .eq("user_id", user.id)
        .eq("recital_success", true)
        .gte("dismissed_at", todayStart.toISOString())
        .lte("dismissed_at", todayEnd.toISOString())
        .order("dismissed_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0 && data[0].verse_ref) {
        const backgroundImageId = data[0].verse_background_image_id ?? null;

        // Resolve the background image URL if an ID is present
        let backgroundImageUrl: string | null = null;
        if (backgroundImageId) {
          const { data: imgData } = await supabase
            .from("verse_background_images")
            .select("url")
            .eq("id", backgroundImageId)
            .single();
          backgroundImageUrl = imgData?.url ?? null;
        }

        setTodayVerse({
          ref: data[0].verse_ref,
          text: data[0].verse_text ?? "",
          backgroundImageUrl,
          found: true,
        });
      } else {
        setTodayVerse({ ref: "", text: "", found: false });
      }
    } catch {
      setTodayVerse({ ref: "", text: "", found: false });
    }
  }, [user]);

  // Refresh on initial mount and when user changes
  useEffect(() => { fetchTodayVerse(); }, [fetchTodayVerse]);

  // Refresh every time the tab comes into focus (handles post-recital updates in tab nav)
  useFocusEffect(useCallback(() => { fetchTodayVerse(); }, [fetchTodayVerse]));

  // Fallback verse for when user hasn't recited today
  const fallbackVerse = BIBLE_VERSES[new Date().getDate() % BIBLE_VERSES.length];
  const nextVerseRef =
    (nextScheduledVerseAlarm?.alarmType === "verse" && nextScheduledVerseAlarm.verseRef
      ? nextScheduledVerseAlarm.verseRef
      : alarms.find((a) => a.enabled && a.alarmType === "verse" && a.verseText)?.verseRef) ??
    fallbackVerse.ref;
  const nextVerseText =
    (nextScheduledVerseAlarm?.alarmType === "verse" && nextScheduledVerseAlarm.verseText
      ? nextScheduledVerseAlarm.verseText
      : alarms.find((a) => a.enabled && a.alarmType === "verse" && a.verseText)?.verseText) ??
    fallbackVerse.text;

  const translation = profile?.preferred_translation ?? "NIV";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 16),
            paddingBottom: 120 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.appTitle, { color: colors.foreground }]}>
            Bible Wake
          </Text>
          <Pressable
            style={[styles.streakBadge, { backgroundColor: colors.card }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/(tabs)/insights");
            }}
          >
            <Image
              source={require("@/assets/images/flame.png")}
              style={styles.flameImg}
              resizeMode="contain"
            />
            <Text style={[styles.streakCount, { color: "#1c1c1e" }]}>
              {streak}
            </Text>
          </Pressable>
        </View>

        {/* Week Dots */}
        <View style={styles.weekSection}>
          <WeekDots activeDayIndex={todayIndex} />
        </View>

        {/* Permission Warning Banner */}
        {!allPermissionsGranted && (
          <Pressable
            style={[styles.permBanner, { backgroundColor: "#FF3B3012", borderColor: "#FF3B3030" }]}
            onPress={() => void Linking.openSettings()}
          >
            <View style={styles.permBannerIcon}>
              <Image
                source={require("@/assets/images/alarm_icon.png")}
                style={styles.permBannerImg}
                resizeMode="contain"
              />
            </View>
            <View style={styles.permBannerText}>
              <Text style={[styles.permBannerTitle, { color: "#FF3B30" }]}>
                {!hasPermission
                  ? "Alarm Access Denied"
                  : Platform.OS === "ios" && !alarmKitAuthorized
                  ? "Alarm Access Denied"
                  : "Exact Alarms Disabled"}
              </Text>
              <Text style={[styles.permBannerSub, { color: colors.mutedForeground }]}>
                Tap to grant permission and enable alarms
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#FF3B30" />
          </Pressable>
        )}

        {/* Next Wake Up */}
        {nextAlarm ? (
          <>
            <Text style={[styles.sectionTitle, { color: "#1c1c1e" }]}>
              Next Wake Up
            </Text>
            <Pressable
              style={[styles.card, { backgroundColor: colors.card }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditingAlarm(nextAlarm);
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.dayName}>
                  {getDayName(
                    nextAlarm.days.findIndex(
                      (d, i) => d && i >= todayIndex
                    ) !== -1
                      ? nextAlarm.days.findIndex(
                          (d, i) => d && i >= todayIndex
                        )
                      : todayIndex
                  )}
                </Text>
                <Switch
                  value={nextAlarm.enabled}
                  onValueChange={() => {
                    Haptics.selectionAsync();
                    toggleAlarm(nextAlarm.id);
                  }}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor="#fff"
                />
              </View>
              <View style={styles.timeRow}>
                <Text style={[styles.bigTime, { color: colors.foreground }]}>
                  {formatTime(nextAlarm.hour, nextAlarm.minute, nextAlarm.isPM)}
                </Text>
                <Text style={[styles.amPm, { color: "#8E8E93" }]}>
                  {" "}{getAmPm(nextAlarm.isPM)}
                </Text>
              </View>
              <View style={styles.ringsRow}>
                <Ionicons
                  name="time-outline"
                  size={17}
                  color={colors.mutedForeground}
                />
                <Text style={styles.ringsText}>
                  {" "}
                  {getRingsIn(nextAlarm.hour, nextAlarm.minute, nextAlarm.isPM)}
                </Text>
              </View>
            </Pressable>

            {/* Info Cards Row */}
            <View style={styles.miniCardsRow}>
              <View style={[styles.miniCard, { backgroundColor: colors.card }]}>
                <View>
                  <Text
                    style={[styles.miniTitle, { color: colors.foreground }]}
                  >
                    Bible Verse
                  </Text>
                  <Text
                    style={[styles.miniSub, { color: colors.mutedForeground }]}
                  >
                    {nextAlarm.verseRef || "—"}
                  </Text>
                </View>
                <View
                  style={[
                    styles.miniIcon,
                    { backgroundColor: colors.accent + "18" },
                  ]}
                >
                  <Ionicons name="book" size={20} color={colors.accent} />
                </View>
              </View>
              <View style={[styles.miniCard, { backgroundColor: colors.card }]}>
                <View>
                  <Text
                    style={[styles.miniTitle, { color: colors.foreground }]}
                  >
                    Alarm Clock
                  </Text>
                  <Text
                    style={[styles.miniSub, { color: colors.mutedForeground }]}
                  >
                    {alarmSoundName}
                  </Text>
                </View>
                <View
                  style={[
                    styles.miniIcon,
                    { backgroundColor: colors.muted },
                  ]}
                >
                  <Ionicons name="notifications" size={20} color={colors.mutedForeground} />
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            {/* Streak row */}
            <Pressable
              style={styles.emptyStreakRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/insights");
              }}
            >
              <Image
                source={require("@/assets/images/flame.png")}
                style={styles.emptyFlame}
                resizeMode="contain"
              />
              <Text style={[styles.emptyStreakText, { color: colors.accent }]}>
                {streak}-day streak
              </Text>
            </Pressable>

            {/* Heading */}
            <Text style={[styles.emptyHeading, { color: colors.foreground }]}>
              {streak === 0
                ? "Set an alarm to start a streak"
                : "Set an alarm to keep it alive"}
            </Text>

            {/* Subtitle */}
            <Text style={styles.emptySubText}>Even no-verse counts</Text>

            {/* Add Alarm button */}
            <Pressable
              style={styles.emptyAddBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowAddAlarm(true);
              }}
            >
              <Text style={[styles.emptyAddBtnText, { color: colors.accent }]}>
                + Add Alarm
              </Text>
            </Pressable>
          </View>
        )}

        {/* Today's Verse */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitleSm, { color: colors.foreground }]}>
            Today's Verse
          </Text>
        </View>

        {todayVerse === null ? (
          // Loading state — subtle placeholder
          <View style={[styles.verseLoadingCard, { backgroundColor: colors.card }]} />
        ) : todayVerse.found ? (
          <VerseCard
            reference={todayVerse.ref}
            text={todayVerse.text}
            version={translation}
            backgroundImageUrl={todayVerse.backgroundImageUrl}
            showShare
            flat
          />
        ) : (
          // No successful recital today
          <View style={[styles.emptyVerseCard, { backgroundColor: colors.card }]}>
            <Ionicons name="book-outline" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyVerseTitle, { color: colors.foreground }]}>
              No verse recited today
            </Text>
            <Text style={[styles.emptyVerseSub, { color: colors.mutedForeground }]}>
              Complete today's alarm to see your verse here
            </Text>
          </View>
        )}

        {/* Upcoming verse preview when no today-verse */}
        {todayVerse !== null && !todayVerse.found && nextAlarm?.alarmType === "verse" && nextVerseRef ? (
          <>
            <View style={[styles.sectionHeader, { marginTop: 16 }]}>
              <Text style={[styles.sectionTitleSm, { color: colors.foreground }]}>
                Up Next
              </Text>
            </View>
            <VerseCard
              reference={nextVerseRef}
              text={nextVerseText}
              version={translation}
              showShare
              flat
            />
          </>
        ) : null}
      </ScrollView>

      <AlarmEditSheet
        visible={showAddAlarm}
        onClose={() => setShowAddAlarm(false)}
        onSave={addAlarm}
      />
      <AlarmEditSheet
        visible={editingAlarm !== null}
        alarm={editingAlarm}
        onClose={() => setEditingAlarm(null)}
        onSave={(updated) => {
          if (editingAlarm) return updateAlarm(editingAlarm.id, updated);
        }}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  appTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  streakBadge: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  flameImg: {
    width: 20,
    height: 20,
  },
  streakCount: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  weekSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  sectionTitleSm: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    marginTop: 24,
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  card: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  dayName: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "#415168",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  bigTime: {
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    letterSpacing: -2,
    lineHeight: 60,
  },
  amPm: {
    fontSize: 20,
    fontFamily: "Inter_500Medium",
    marginBottom: 10,
  },
  ringsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  ringsText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#8E8E93",
  },
  miniCardsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  miniCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    justifyContent: "space-between",
    minHeight: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  miniTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  miniSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  miniIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    marginTop: 8,
  },
  emptyCard: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyStreakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  emptyFlame: {
    width: 22,
    height: 22,
  },
  emptyStreakText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  emptyHeading: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 2,
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#415168",
    marginBottom: 6,
  },
  emptyAddBtn: {
    marginTop: 14,
    backgroundColor: "#FFF3E8",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 40,
  },
  emptyAddBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  verseLoadingCard: {
    borderRadius: 20,
    height: 120,
    opacity: 0.4,
  },
  emptyVerseCard: {
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyVerseTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    marginTop: 4,
  },
  emptyVerseSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  verseCard: {
    borderRadius: 20,
    overflow: "hidden",
    height: 200,
  },
  verseCardBg: {
    flex: 1,
  },
  verseCardImg: {
    borderRadius: 20,
  },
  verseCardContent: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  verseCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verseTagBg: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verseTagText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  verseCardBottom: {
    gap: 4,
  },
  verseCardRef: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    opacity: 0.85,
  },
  verseCardText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  permBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  permBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FF3B3020",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  permBannerImg: {
    width: 20,
    height: 20,
  },
  permBannerText: {
    flex: 1,
    gap: 2,
  },
  permBannerTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  permBannerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});

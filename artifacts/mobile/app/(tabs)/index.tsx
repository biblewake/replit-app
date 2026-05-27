import React, { useState } from "react";
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAlarms } from "@/context/AlarmContext";
import WeekDots from "@/components/WeekDots";
import AlarmEditSheet from "@/components/AlarmEditSheet";
import { BIBLE_VERSES } from "@/constants/verses";

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
  const { alarms, toggleAlarm, addAlarm, streak, getNextAlarm } = useAlarms();
  const [showAddAlarm, setShowAddAlarm] = useState(false);
  const [showVerseDetail, setShowVerseDetail] = useState(false);

  const todayIndex = new Date().getDay();
  const nextAlarm = getNextAlarm();
  const todayVerse = BIBLE_VERSES[new Date().getDate() % BIBLE_VERSES.length];

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
          <View style={[styles.streakBadge, { backgroundColor: colors.card }]}>
            <Image
              source={require("@/assets/images/flame.png")}
              style={styles.flameImg}
              resizeMode="contain"
            />
            <Text style={[styles.streakCount, { color: colors.foreground }]}>
              {streak}
            </Text>
          </View>
        </View>

        {/* Week Dots */}
        <View style={styles.weekSection}>
          <WeekDots activeDayIndex={todayIndex} />
        </View>

        {/* Next Wake Up */}
        {nextAlarm ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Next Wake Up
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.dayName, { color: colors.blue }]}>
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
                <Text style={[styles.amPm, { color: colors.foreground }]}>
                  {" "}{getAmPm(nextAlarm.isPM)}
                </Text>
              </View>
              <View style={styles.ringsRow}>
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[styles.ringsText, { color: colors.mutedForeground }]}
                >
                  {" "}
                  {getRingsIn(nextAlarm.hour, nextAlarm.minute, nextAlarm.isPM)}
                </Text>
              </View>
            </View>

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
                    {nextAlarm.verseRef}
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
                    Sound
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
          <Pressable
            style={[styles.emptyCard, { backgroundColor: colors.card }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAddAlarm(true);
            }}
          >
            <Ionicons name="add-circle-outline" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No alarms set
            </Text>
            <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
              Tap to add your first alarm
            </Text>
          </Pressable>
        )}

        {/* Today's Verse */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Today's Verse
          </Text>
          <Text style={[styles.seeAll, { color: colors.mutedForeground }]}>
            See All
          </Text>
        </View>
        <Pressable
          style={styles.verseCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowVerseDetail(true);
          }}
        >
          <ImageBackground
            source={require("@/assets/images/today_verse_bg.png")}
            style={styles.verseCardBg}
            imageStyle={styles.verseCardImg}
          >
            <View style={styles.verseCardContent}>
              <View style={styles.verseCardTop}>
                <View style={styles.verseTagBg}>
                  <Text style={styles.verseTagText}>
                    {todayVerse.category}
                  </Text>
                </View>
                <View style={styles.shareBtn}>
                  <Feather name="share" size={16} color="#fff" />
                </View>
              </View>
              <View style={styles.verseCardBottom}>
                <Text style={styles.verseCardRef}>{todayVerse.ref}</Text>
                <Text style={styles.verseCardText} numberOfLines={3}>
                  {todayVerse.text}
                </Text>
              </View>
            </View>
          </ImageBackground>
        </Pressable>
      </ScrollView>

      <AlarmEditSheet
        visible={showAddAlarm}
        onClose={() => setShowAddAlarm(false)}
        onSave={addAlarm}
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
    marginBottom: 14,
  },
  appTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  streakBadge: {
    flexDirection: "row",
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
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
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
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
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
    fontSize: 13,
    fontFamily: "Inter_400Regular",
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
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  miniSub: {
    fontSize: 13,
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
    borderRadius: 18,
    padding: 32,
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
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
});

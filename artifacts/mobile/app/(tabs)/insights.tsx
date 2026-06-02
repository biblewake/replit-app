import React, { useMemo, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useIsNativeTabs } from "@/hooks/useIsNativeTabs";
import { useAlarms } from "@/context/AlarmContext";
import HeatmapCalendar from "@/components/HeatmapCalendar";
import BottomSheet from "@/components/BottomSheet";

interface MemorizedVerse {
  ref: string;
  memorizedPct: number;
  completions: number;
}

const PLACEHOLDER_VERSES: MemorizedVerse[] = [
  { ref: "John 3:16", memorizedPct: 70, completions: 12 },
  { ref: "Acts 5:16", memorizedPct: 50, completions: 2 },
  { ref: "Romans 8:28", memorizedPct: 85, completions: 7 },
];

const AVATAR_COLORS = [
  "#A8E6CF", "#FFD3B6", "#FFAAA5", "#B5EAD7",
  "#C7CEEA", "#FFDAC1", "#E2F0CB", "#F0E6EF",
];

function getAvatarColor(ref: string): string {
  const idx = ref.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function VerseCard({ verse, colors }: { verse: MemorizedVerse; colors: ReturnType<typeof useColors> }) {
  const firstLetter = verse.ref.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(verse.ref);

  return (
    <View style={[styles.verseCard, { backgroundColor: colors.card }]}>
      <View style={[styles.verseAvatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.verseAvatarLetter}>{firstLetter}</Text>
      </View>
      <View style={styles.verseContent}>
        <Text style={[styles.verseRef, { color: colors.foreground }]}>
          {verse.ref}
        </Text>
        <View style={styles.verseStats}>
          <View style={styles.verseStat}>
            <Image
              source={require("@/assets/images/heart_1780185736902.png")}
              style={styles.verseStatIcon}
              resizeMode="contain"
            />
            <Text style={[styles.verseStatText, { color: colors.mutedForeground }]}>
              Memorized: {verse.memorizedPct}%
            </Text>
          </View>
          <View style={styles.verseStat}>
            <Image
              source={require("@/assets/images/growth_1780185736903.png")}
              style={styles.verseStatIcon}
              resizeMode="contain"
            />
            <Text style={[styles.verseStatText, { color: colors.mutedForeground }]}>
              Completions: {verse.completions}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function StatCell({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.statCell}>
      <View style={styles.statCellHeader}>
        {icon}
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isNativeTabs = useIsNativeTabs();
  const { streak, longestStreak } = useAlarms();
  const [showMemoryInfo, setShowMemoryInfo] = useState(false);

  const paddingTop = insets.top + (Platform.OS === "web" ? 67 : 16);

  const activeDays = useMemo<Set<string>>(() => new Set(), []);
  const successfulWakeUps = activeDays.size;

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
          Insights
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          STATS
        </Text>

        {/* Heatmap Card */}
        <View style={[styles.heatmapCard, { backgroundColor: colors.card }]}>
          <View style={styles.heatmapHeadingRow}>
            <Text style={[styles.heatmapCount, { color: colors.foreground }]}>
              {successfulWakeUps} Successful Wake-ups
            </Text>
            <Text style={[styles.heatmapRange, { color: colors.mutedForeground }]}>
              Last 12 months
            </Text>
          </View>
          <Text style={[styles.heatmapSubtext, { color: colors.mutedForeground }]}>
            Every successful wake-up is a verse recited
          </Text>
          <HeatmapCalendar activeDays={activeDays} />
        </View>

        {/* Streak Cards Row */}
        <View style={styles.streakRow}>
          <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
            <Image
              source={require("@/assets/images/flame_1780182885546.png")}
              style={styles.streakIcon}
              resizeMode="contain"
            />
            <View style={styles.streakTextCol}>
              <Text style={[styles.streakNumber, { color: colors.foreground }]}>
                {streak}
              </Text>
              <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>
                Day Streak
              </Text>
            </View>
          </View>

          <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
            <Image
              source={require("@/assets/images/medal_1780184643296.png")}
              style={styles.streakIcon}
              resizeMode="contain"
            />
            <View style={styles.streakTextCol}>
              <Text style={[styles.streakNumber, { color: colors.foreground }]}>
                {longestStreak}
              </Text>
              <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>
                Longest Streak
              </Text>
            </View>
          </View>
        </View>

        {/* Stats Grid (moved below streak row) */}
        <View style={[styles.statsGrid, { backgroundColor: colors.card }]}>
          <View style={styles.statsRow}>
            <StatCell
              icon={
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={colors.mutedForeground}
                />
              }
              label="Avg Wake Time"
              value="11:38 AM"
              colors={colors}
            />
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <StatCell
              icon={
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={colors.mutedForeground}
                />
              }
              label="Avg Response"
              value="36s"
              colors={colors}
            />
          </View>
          <View style={[styles.statHDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statsRow}>
            <StatCell
              icon={
                <Ionicons
                  name="book-outline"
                  size={14}
                  color={colors.mutedForeground}
                />
              }
              label="Verses Recited"
              value="17"
              colors={colors}
            />
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <StatCell
              icon={
                <Ionicons
                  name="musical-notes-outline"
                  size={14}
                  color={colors.mutedForeground}
                />
              }
              label="Favorite Verse"
              value="1 Cor 2:3"
              colors={colors}
            />
          </View>
        </View>

        {/* MEMORY section */}
        <View style={styles.sectionLabelRow}>
          <Text style={[styles.sectionLabel, styles.sectionLabelNoMargin, { color: colors.mutedForeground }]}>
            MEMORY
          </Text>
          <Pressable
            style={[styles.helpIcon, { backgroundColor: colors.secondary }]}
            onPress={() => setShowMemoryInfo(true)}
            hitSlop={8}
          >
            <Ionicons name="help" size={11} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <View style={[styles.statsGrid, { backgroundColor: colors.card }]}>
          <View style={styles.statsRow}>
            <StatCell
              icon={
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={colors.mutedForeground}
                />
              }
              label="Verses Memorized"
              value="11"
              colors={colors}
            />
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <StatCell
              icon={
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={colors.mutedForeground}
                />
              }
              label="Success Rate"
              value="87%"
              colors={colors}
            />
          </View>
        </View>

        {/* MEMORIZED VERSES section */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          MEMORIZED VERSES
        </Text>

        <View style={styles.verseList}>
          {PLACEHOLDER_VERSES.map((verse) => (
            <VerseCard key={verse.ref} verse={verse} colors={colors} />
          ))}
        </View>
      </ScrollView>

      {/* Memory info bottom sheet */}
      <BottomSheet
        visible={showMemoryInfo}
        onClose={() => setShowMemoryInfo(false)}
        height="auto"
      >
        <View style={styles.memoryInfoSheet}>
          <View style={styles.memoryInfoHeader}>
            <Text style={[styles.memoryInfoTitle, { color: colors.foreground }]}>
              About Memory
            </Text>
            <Pressable
              onPress={() => setShowMemoryInfo(false)}
              style={[styles.memoryInfoClose, { backgroundColor: colors.secondary }]}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={[styles.memoryInfoText, { color: colors.mutedForeground }]}>
            Memorized means you recited the verse from memory, without a hint or preview. Your success rate tracks how often you nailed it at 70% accuracy or above.
          </Text>
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
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionLabelNoMargin: {
    marginBottom: 0,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    marginBottom: 10,
  },
  helpIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    borderRadius: 18,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  statsRow: {
    flexDirection: "row",
  },
  statCell: {
    flex: 1,
    padding: 16,
    gap: 6,
  },
  statCellHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
  },
  statHDivider: {
    height: StyleSheet.hairlineWidth,
  },
  heatmapCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  heatmapHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  heatmapCount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  heatmapRange: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  heatmapSubtext: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  streakRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  streakCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  streakIcon: {
    width: 36,
    height: 36,
  },
  streakTextCol: {
    flexDirection: "column",
  },
  streakNumber: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    lineHeight: 32,
  },
  streakLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  verseList: {
    gap: 10,
    marginBottom: 10,
  },
  verseCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  verseAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  verseAvatarLetter: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#444",
  },
  verseContent: {
    flex: 1,
    gap: 4,
  },
  verseRef: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  verseStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  verseStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verseStatIcon: {
    width: 14,
    height: 14,
  },
  verseStatText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  memoryInfoSheet: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  memoryInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  memoryInfoTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  memoryInfoClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  memoryInfoText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
  },
});

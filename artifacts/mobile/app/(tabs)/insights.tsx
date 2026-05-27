import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useAlarms } from "@/context/AlarmContext";
import RecitationChart from "@/components/RecitationChart";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const TODAY_INDEX = new Date().getDay();

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
  const { streak } = useAlarms();

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
          Insights
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          STATS
        </Text>

        <View style={styles.topRow}>
          {/* Day Streak Card */}
          <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
            <View style={styles.flameContainer}>
              <Text style={styles.flameEmoji}>🔥</Text>
            </View>
            <Text style={[styles.streakNumber, { color: colors.foreground }]}>
              {streak}
            </Text>
            <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>
              Day Streak
            </Text>
            <View style={styles.weekDots}>
              {DAY_LETTERS.map((l, i) => (
                <View
                  key={i}
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor:
                        i === TODAY_INDEX ? "transparent" : colors.secondary,
                      borderWidth: i === TODAY_INDEX ? 1.5 : 0,
                      borderColor: i === TODAY_INDEX ? colors.foreground : "transparent",
                    },
                  ]}
                >
                  {i === TODAY_INDEX ? (
                    <Ionicons name="checkmark" size={9} color={colors.foreground} />
                  ) : (
                    <Text
                      style={[styles.weekDotLetter, { color: colors.mutedForeground }]}
                    >
                      {l}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Badges Card */}
          <View style={[styles.badgesCard, { backgroundColor: colors.card }]}>
            <View style={styles.badgeHexagon}>
              <View style={[styles.hexBg, { backgroundColor: "#2A2A3E" }]}>
                <Text style={styles.hexNumber}>1</Text>
              </View>
            </View>
            <Text style={[styles.badgeLabel, { color: colors.foreground }]}>
              Badges Earned
            </Text>
            <View style={styles.badgeIconRow}>
              <View
                style={[styles.badgeIcon, { backgroundColor: "#FF9500" + "22" }]}
              >
                <MaterialCommunityIcons
                  name="hexagon"
                  size={28}
                  color="#FF9500"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Stats Grid */}
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

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          MEMORY
        </Text>

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

        <Text style={[styles.chartTitle, { color: colors.foreground }]}>
          Recitation Trend
        </Text>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <RecitationChart />
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
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  streakCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  flameContainer: {
    marginBottom: 4,
  },
  flameEmoji: {
    fontSize: 36,
  },
  streakNumber: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  streakLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  weekDots: {
    flexDirection: "row",
    gap: 3,
  },
  weekDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDotLetter: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
  },
  badgesCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeHexagon: {
    marginBottom: 4,
  },
  hexBg: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hexNumber: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  badgeLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 8,
  },
  badgeIconRow: {
    flexDirection: "row",
    gap: 6,
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  chartTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
    marginBottom: 12,
  },
  chartCard: {
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
});

import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet from "@/components/BottomSheet";
import { useColors } from "@/hooks/useColors";

interface MilestonesSheetProps {
  visible: boolean;
  onClose: () => void;
  streak: number;
}

interface Badge {
  name: string;
  days: number;
}

const BADGES: Badge[] = [
  { name: "Risen", days: 1 },
  { name: "Ignite", days: 3 },
  { name: "Horizon", days: 7 },
  { name: "Aurora", days: 14 },
  { name: "Celestial", days: 30 },
  { name: "Solstice", days: 50 },
  { name: "Eternal", days: 100 },
  { name: "Covenant", days: 200 },
  { name: "Genesis", days: 365 },
];

export default function MilestonesSheet({
  visible,
  onClose,
  streak,
}: MilestonesSheetProps) {
  const colors = useColors();

  const earnedBadges = streak >= 1 ? 1 : 0;
  const badgeProgress = earnedBadges / BADGES.length;

  return (
    <BottomSheet visible={visible} onClose={onClose} height="auto" backgroundColor="#F7FAFF" showCloseButton={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header row */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={onClose}
            hitSlop={4}
          >
            <BlurView intensity={65} tint="light" style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="rgba(0,0,0,0.55)" />
            </BlurView>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Milestones
          </Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Hero stats */}
        <View style={styles.heroRow}>
          <View style={[styles.heroCard, { backgroundColor: colors.card }]}>
            <Image
              source={require("@/assets/images/flame_milestone.png")}
              style={styles.heroImg}
              resizeMode="contain"
            />
            <Text style={[styles.heroNumber, { color: colors.foreground }]}>
              {streak}
            </Text>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>
              Day Streak
            </Text>
          </View>
          <View style={[styles.heroCard, { backgroundColor: colors.card }]}>
            <Image
              source={require("@/assets/images/badge_milestone.png")}
              style={styles.heroImg}
              resizeMode="contain"
            />
            <Text style={[styles.heroNumber, { color: colors.foreground }]}>
              {earnedBadges}
            </Text>
            <Text style={[styles.heroLabel, { color: colors.mutedForeground }]}>
              Badges Earned
            </Text>
          </View>
        </View>

        {/* Info pill rows */}
        <View style={[styles.pillRow, { backgroundColor: colors.card }]}>
          <Image
            source={require("@/assets/images/flame_milestone.png")}
            style={styles.pillImg}
            resizeMode="contain"
          />
          <Text style={[styles.pillText, { color: colors.foreground }]}>
            Longest streak
          </Text>
          <Text style={[styles.pillValue, { color: colors.mutedForeground }]}>
            {streak} days
          </Text>
        </View>

        <View style={[styles.pillRow, { backgroundColor: colors.card }]}>
          <Image
            source={require("@/assets/images/badge_milestone.png")}
            style={styles.pillImg}
            resizeMode="contain"
          />
          <Text style={[styles.pillText, { color: colors.foreground }]}>
            {earnedBadges}/9 badges
          </Text>
          <View style={styles.progressBarOuter}>
            <View
              style={[
                styles.progressBarInner,
                { width: `${Math.round(badgeProgress * 100)}%`, backgroundColor: colors.accent },
              ]}
            />
          </View>
        </View>

        {/* Streak Badges section */}
        <Text style={[styles.sectionHeader, { color: colors.foreground }]}>
          Streak Badges
        </Text>
        <View style={styles.badgeGrid}>
          {BADGES.map((badge) => {
            const unlocked = badge.name === "Risen" && streak >= 1;
            return (
              <View
                key={badge.name}
                style={[
                  styles.badgeItem,
                  { backgroundColor: colors.card },
                ]}
              >
                {unlocked ? (
                  <View style={styles.badgeImgWrap}>
                    <Image
                      source={require("@/assets/images/badge_milestone.png")}
                      style={styles.badgeImg}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.badgeLocked,
                      { backgroundColor: colors.muted },
                    ]}
                  >
                    <Ionicons
                      name="lock-closed"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </View>
                )}
                <Text
                  style={[
                    styles.badgeName,
                    { color: unlocked ? colors.foreground : colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {badge.name}
                </Text>
                <Text
                  style={[styles.badgeDays, { color: colors.mutedForeground }]}
                >
                  {badge.days} {badge.days === 1 ? "day" : "days"}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 4,
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
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  heroRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  heroCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    backgroundColor: "#fff",
  },
  heroImg: {
    width: 48,
    height: 48,
    marginBottom: 4,
  },
  heroNumber: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    lineHeight: 40,
  },
  heroLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 40,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    backgroundColor: "#fff",
  },
  pillImg: {
    width: 20,
    height: 20,
  },
  pillText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  pillValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  progressBarOuter: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(65,81,104,0.12)",
    overflow: "hidden",
  },
  progressBarInner: {
    height: "100%",
    borderRadius: 3,
    minWidth: 6,
  },
  sectionHeader: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginTop: 20,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeItem: {
    width: "31%",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    backgroundColor: "#fff",
  },
  badgeImgWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeImg: {
    width: 48,
    height: 48,
  },
  badgeLocked: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  badgeDays: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});

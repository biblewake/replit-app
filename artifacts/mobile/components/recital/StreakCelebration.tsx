import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";
import WeekDots from "@/components/WeekDots";

interface StreakCelebrationProps {
  streak: number;
  onContinue: () => void;
}

export default function StreakCelebration({ streak, onContinue }: StreakCelebrationProps) {
  const todayIndex = new Date().getDay();
  return (
    <Pressable style={styles.container} onPress={onContinue}>
      <LottieView
        source={require("@/assets/animations/fire.json")}
        autoPlay
        loop
        style={styles.lottie}
      />
      <Text style={styles.streakNum}>{streak}</Text>
      <Text style={styles.streakLabel}>Day Streak!</Text>
      <View style={styles.weekDotsWrap}>
        <WeekDots activeDayIndex={todayIndex} size="sm" />
      </View>
      <Text style={styles.tapHint}>Tap to continue</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 32,
  },
  lottie: {
    width: 160,
    height: 160,
  },
  streakNum: {
    fontSize: 72,
    fontFamily: "Inter_700Bold",
    color: "#FF9500",
    lineHeight: 80,
  },
  streakLabel: {
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  weekDotsWrap: {
    width: "100%",
    paddingHorizontal: 16,
  },
  tapHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginTop: 24,
  },
});

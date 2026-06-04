import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";

interface AlarmSuccessProps {
  onContinue: () => void;
  accuracy?: number | null;
}

export default function AlarmSuccess({ onContinue, accuracy }: AlarmSuccessProps) {
  useEffect(() => {
    const timer = setTimeout(onContinue, 2500);
    return () => clearTimeout(timer);
  }, []);

  const accuracyPct = accuracy != null ? Math.round(accuracy * 100) : null;

  return (
    <Pressable style={styles.container} onPress={onContinue}>
      <LottieView
        source={require("@/assets/animations/success.json")}
        autoPlay
        loop={false}
        style={styles.lottie}
      />
      <Text style={styles.heading}>Alarm Turned Off!</Text>
      {accuracyPct != null && (
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreLabel}>Accuracy</Text>
          <Text style={styles.scoreValue}>{accuracyPct}%</Text>
        </View>
      )}
      <Text style={styles.sub}>Great job!</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#F2F2F7",
  },
  lottie: {
    width: 160,
    height: 160,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#1C1C1E",
    textAlign: "center",
  },
  scoreBadge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 2,
  },
  scoreLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  scoreValue: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: "#34C759",
    lineHeight: 46,
  },
  sub: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "#6B6B6B",
    textAlign: "center",
  },
});

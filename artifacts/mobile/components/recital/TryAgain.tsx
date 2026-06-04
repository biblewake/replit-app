import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface TryAgainProps {
  onTryAgain: () => void;
  accuracy?: number | null;
  verseMode?: "memory" | "declare";
}

export default function TryAgain({ onTryAgain, accuracy, verseMode = "memory" }: TryAgainProps) {
  const accuracyPct = accuracy != null ? Math.round(accuracy * 100) : null;

  const subMessage =
    verseMode === "declare"
      ? "Try reading the verse more clearly and slowly"
      : "Speak the verse from memory, word for word";

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="close" size={40} color="#FF3B30" />
      </View>
      <Text style={styles.heading}>Let's Try Again</Text>
      {accuracyPct != null && (
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreLabel}>Accuracy</Text>
          <Text style={styles.scoreValue}>{accuracyPct}%</Text>
        </View>
      )}
      <Text style={styles.sub}>{subMessage}</Text>
      <Pressable style={styles.btn} onPress={onTryAgain}>
        <Text style={styles.btnText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 32,
    backgroundColor: "#F2F2F7",
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FF3B3015",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heading: {
    fontSize: 26,
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
    color: "#FF3B30",
    lineHeight: 46,
  },
  sub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#6B6B6B",
    textAlign: "center",
    lineHeight: 22,
  },
  btn: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 100,
    marginTop: 8,
  },
  btnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

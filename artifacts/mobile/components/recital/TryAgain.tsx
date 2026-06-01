import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface TryAgainProps {
  onTryAgain: () => void;
}

export default function TryAgain({ onTryAgain }: TryAgainProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="close" size={40} color="#FF3B30" />
      </View>
      <Text style={styles.heading}>Let's Try Again</Text>
      <Text style={styles.sub}>Speak clearly and match the words shown</Text>
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

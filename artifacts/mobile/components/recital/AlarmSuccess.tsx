import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";

interface AlarmSuccessProps {
  onContinue: () => void;
}

export default function AlarmSuccess({ onContinue }: AlarmSuccessProps) {
  useEffect(() => {
    const timer = setTimeout(onContinue, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Pressable style={styles.container} onPress={onContinue}>
      <LottieView
        source={require("@/assets/animations/success.json")}
        autoPlay
        loop={false}
        style={styles.lottie}
      />
      <Text style={styles.heading}>Alarm Turned Off!</Text>
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
  sub: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: "#6B6B6B",
    textAlign: "center",
  },
});

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

interface AnalyzingVerseProps {
  onResult: (passed: boolean, accuracy: number) => void;
  spoken: string;
  target: string;
  /** The user's preferred Bible translation (e.g. "NIV", "ESV"). Passed to the
   *  accuracy-check function so AI-backed validation can reference the correct
   *  translation text. Currently used by the local matcher; reserved for server
   *  calls once AI validation is wired. */
  translation?: string;
}

export default function AnalyzingVerse({ onResult, spoken, target, translation = "NIV" }: AnalyzingVerseProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.2, duration: 400, useNativeDriver: true }),
        ])
      );
    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 160);
    const a3 = pulse(dot3, 320);
    a1.start();
    a2.start();
    a3.start();

    const timer = setTimeout(() => {
      a1.stop();
      a2.stop();
      a3.stop();
      const { checkVerseAccuracy } = require("@/utils/verseMatch");
      const score: number = checkVerseAccuracy(spoken, target, translation);
      onResult(score >= 0.70, score);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
        ))}
      </View>
      <Text style={styles.heading}>Analyzing Your Verse</Text>
      <Text style={styles.sub}>Checking your accuracy…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    backgroundColor: "#F2F2F7",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#1C1C1E",
  },
  heading: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#1C1C1E",
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#6B6B6B",
    textAlign: "center",
  },
});

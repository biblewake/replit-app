import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import LottieView from "lottie-react-native";
import * as Haptics from "expo-haptics";
import WeekDots from "@/components/WeekDots";

interface StreakCelebrationProps {
  streak: number;
  onContinue: () => void;
}

export default function StreakCelebration({ streak, onContinue }: StreakCelebrationProps) {
  const todayIndex = new Date().getDay();

  const lottieRef = useRef<LottieView>(null);
  const lottieFade = useRef(new Animated.Value(0)).current;
  const numFade = useRef(new Animated.Value(0)).current;
  const dotsFade = useRef(new Animated.Value(0)).current;
  const btnTranslate = useRef(new Animated.Value(40)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const hapticRamp = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((r) => setTimeout(r, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await new Promise((r) => setTimeout(r, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((r) => setTimeout(r, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const sequence = async () => {
      await new Promise((r) => setTimeout(r, 450));

      lottieRef.current?.play();
      Animated.timing(lottieFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();

      hapticRamp();

      await new Promise((r) => setTimeout(r, 400));

      Animated.timing(numFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await new Promise((r) => setTimeout(r, 600));

      Animated.timing(dotsFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();

      await new Promise((r) => setTimeout(r, 400));

      Animated.parallel([
        Animated.timing(btnOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(btnTranslate, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    };

    sequence();
  }, []);

  const handleContinue = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onContinue();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Animated.View style={{ opacity: lottieFade }}>
        <LottieView
          ref={lottieRef}
          source={require("@/assets/animations/fire.json")}
          autoPlay={false}
          loop
          style={styles.lottie}
        />
      </Animated.View>

      <Animated.View style={{ opacity: numFade, alignItems: "center" }}>
        <Text style={styles.streakNum}>{streak}</Text>
        <Text style={styles.streakLabel}>Day Streak!</Text>
      </Animated.View>

      <Animated.View style={[styles.weekDotsWrap, { opacity: dotsFade }]}>
        <WeekDots activeDayIndex={todayIndex} size="sm" />
      </Animated.View>

      <Animated.View
        style={{
          opacity: btnOpacity,
          transform: [{ translateY: btnTranslate }],
          width: "100%",
        }}
      >
        <Pressable style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>Tap Continue</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
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
    color: "#1C1C1E",
    marginBottom: 8,
  },
  weekDotsWrap: {
    width: "100%",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  continueBtn: {
    backgroundColor: "#FF9000",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 24,
    width: "100%",
  },
  continueBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

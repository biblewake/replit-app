import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const FLAME_ICON = require("@/assets/images/check_mark.png");

interface WeekDotsProps {
  activeDayIndex?: number;
  size?: "sm" | "md";
}

export default function WeekDots({
  activeDayIndex,
  size = "md",
}: WeekDotsProps) {
  const dotSize = size === "sm" ? 28 : 34;

  return (
    <View style={styles.row}>
      {DAY_LETTERS.map((letter, index) => {
        const isToday = index === activeDayIndex;
        return (
          <View key={index} style={styles.col}>
            <Text
              style={[
                styles.letter,
                isToday && styles.letterToday,
              ]}
            >
              {letter}
            </Text>
            {isToday ? (
              <LinearGradient
                colors={["#F5511E", "#FF9000"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.gradientRing,
                  { width: dotSize + 4, height: dotSize + 4, borderRadius: (dotSize + 4) / 2 },
                ]}
              >
                <View
                  style={[
                    styles.dotInner,
                    { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
                  ]}
                >
                  <Image
                    source={FLAME_ICON}
                    style={styles.checkIcon}
                    resizeMode="contain"
                  />
                </View>
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.dot,
                  { width: dotSize, height: dotSize, borderRadius: dotSize / 2 },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  col: {
    alignItems: "center",
    gap: 6,
  },
  letter: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#415168",
  },
  letterToday: {
    fontFamily: "Inter_700Bold",
    color: "#0D0D0D",
  },
  gradientRing: {
    alignItems: "center",
    justifyContent: "center",
  },
  dotInner: {
    backgroundColor: "#E2E9F1",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    backgroundColor: "#E2E9F1",
  },
  checkIcon: {
    width: 14,
    height: 14,
  },
});

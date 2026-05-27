import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Ionicons } from "@expo/vector-icons";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

interface WeekDotsProps {
  activeDayIndex?: number;
  size?: "sm" | "md";
}

export default function WeekDots({
  activeDayIndex,
  size = "md",
}: WeekDotsProps) {
  const colors = useColors();
  const dotSize = size === "sm" ? 28 : 34;
  const fontSize = size === "sm" ? 11 : 12;

  return (
    <View style={styles.row}>
      {DAY_LETTERS.map((letter, index) => {
        const isActive = index === activeDayIndex;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: isActive ? "transparent" : colors.secondary,
                borderWidth: isActive ? 2 : 0,
                borderColor: isActive ? colors.foreground : "transparent",
              },
            ]}
          >
            {isActive ? (
              <Ionicons name="checkmark" size={14} color={colors.foreground} />
            ) : (
              <Text
                style={[
                  styles.letter,
                  {
                    fontSize,
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {letter}
              </Text>
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
    gap: 4,
    alignItems: "center",
  },
  dot: {
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {},
});

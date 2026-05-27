import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const DATA = [
  { day: "Mon", count: 2 },
  { day: "Tue", count: 5 },
  { day: "Wed", count: 3 },
  { day: "Thu", count: 7 },
  { day: "Fri", count: 4 },
  { day: "Sat", count: 6 },
  { day: "Sun", count: 2 },
];

const MAX = 9;
const CHART_HEIGHT = 100;

export default function RecitationChart() {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <View style={styles.yLabels}>
        {[MAX, Math.floor(MAX / 2)].map((val) => (
          <Text
            key={val}
            style={[styles.yLabel, { color: colors.mutedForeground }]}
          >
            {val}
          </Text>
        ))}
      </View>
      <View style={styles.chartArea}>
        <View style={styles.gridLines}>
          {[0, 1].map((i) => (
            <View
              key={i}
              style={[styles.gridLine, { borderColor: colors.border }]}
            />
          ))}
        </View>
        <View style={styles.bars}>
          {DATA.map((item) => {
            const barHeight = (item.count / MAX) * CHART_HEIGHT;
            return (
              <View key={item.day} style={styles.barGroup}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: colors.success,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.dayLabel,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {item.day}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    marginTop: 8,
    height: CHART_HEIGHT + 30,
  },
  yLabels: {
    width: 24,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingBottom: 24,
    paddingRight: 4,
  },
  yLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  chartArea: {
    flex: 1,
    position: "relative",
  },
  gridLines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    justifyContent: "space-between",
  },
  gridLine: {
    borderTopWidth: StyleSheet.hairlineWidth,
    width: "100%",
  },
  bars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 24,
    gap: 6,
  },
  barGroup: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  bar: {
    width: "70%",
    borderRadius: 6,
    minHeight: 4,
  },
  dayLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    position: "absolute",
    bottom: 0,
  },
});

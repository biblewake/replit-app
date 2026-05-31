import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const CELL_SIZE = 13;
const CELL_GAP = 2;
const WEEK_STEP = CELL_SIZE + CELL_GAP;
const DAY_LABEL_WIDTH = 36;
const MONTH_ROW_HEIGHT = 16;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const INACTIVE_COLOR = "#FFF1E7";
const ACTIVE_COLOR = "#FF6A00";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface HeatmapCalendarProps {
  activeDays: Set<string>;
}

export default function HeatmapCalendar({ activeDays }: HeatmapCalendarProps) {
  const { weeks, monthLabels } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const endDate = new Date(today);

    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 52 * 7 + 1);

    const startSunday = new Date(startDate);
    startSunday.setDate(startSunday.getDate() - startSunday.getDay());

    const weeksArr: (string | null)[][] = [];
    const monthMap: { weekIndex: number; label: string }[] = [];

    const cursor = new Date(startSunday);
    while (cursor <= endDate) {
      const week: (string | null)[] = [];
      const weekIndex = weeksArr.length;

      for (let d = 0; d < 7; d++) {
        const inRange = cursor >= startDate && cursor <= endDate;
        week.push(inRange ? toISODate(cursor) : null);
        cursor.setDate(cursor.getDate() + 1);
      }

      const firstDay = week.find((day) => day !== null);
      if (firstDay) {
        const date = new Date(firstDay + "T00:00:00");
        if (date.getDate() <= 7) {
          monthMap.push({ weekIndex, label: MONTH_NAMES[date.getMonth()] });
        }
      }

      weeksArr.push(week);
    }

    return { weeks: weeksArr, monthLabels: monthMap };
  }, []);

  const totalGridWidth = weeks.length * WEEK_STEP - CELL_GAP;

  return (
    <View style={styles.container}>
      <View style={styles.layout}>
        {/* Day-of-week labels column */}
        <View style={styles.dayLabelsCol}>
          <View style={{ height: MONTH_ROW_HEIGHT }} />
          {DAY_LABELS.map((label, i) => (
            <View key={i} style={styles.dayLabelCell}>
              <Text style={styles.dayLabelText}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Scrollable month + grid */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollArea}
        >
          <View style={{ width: totalGridWidth }}>
            {/* Month labels row */}
            <View style={[styles.monthRow, { width: totalGridWidth }]}>
              {monthLabels.map(({ weekIndex, label }) => (
                <Text
                  key={weekIndex}
                  style={[
                    styles.monthLabel,
                    { left: weekIndex * WEEK_STEP },
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>

            {/* Week columns grid */}
            <View style={styles.weeksGrid}>
              {weeks.map((week, wi) => (
                <View key={wi} style={styles.weekCol}>
                  {week.map((day, di) => (
                    <View
                      key={di}
                      style={[
                        styles.cell,
                        {
                          backgroundColor:
                            day !== null
                              ? activeDays.has(day)
                                ? ACTIVE_COLOR
                                : INACTIVE_COLOR
                              : "transparent",
                        },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  layout: {
    flexDirection: "row",
  },
  dayLabelsCol: {
    width: DAY_LABEL_WIDTH,
    flexDirection: "column",
    gap: CELL_GAP,
  },
  dayLabelCell: {
    height: CELL_SIZE,
    justifyContent: "center",
  },
  dayLabelText: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
    color: "#888",
    lineHeight: CELL_SIZE,
  },
  scrollArea: {
    flex: 1,
  },
  monthRow: {
    height: MONTH_ROW_HEIGHT,
    position: "relative",
    marginBottom: CELL_GAP,
  },
  monthLabel: {
    position: "absolute",
    top: 2,
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: "#888",
  },
  weeksGrid: {
    flexDirection: "row",
    gap: CELL_GAP,
  },
  weekCol: {
    flexDirection: "column",
    gap: CELL_GAP,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 2,
  },
});

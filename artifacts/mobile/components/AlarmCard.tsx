import React from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { Alarm } from "@/context/AlarmContext";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AlarmCardProps {
  alarm: Alarm;
  onToggle: () => void;
  onPress: () => void;
  onPermissionDenied?: () => void;
}

function formatTime(alarm: Alarm): string {
  const h = alarm.hour === 0 ? 12 : alarm.hour;
  const m = alarm.minute.toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatAmPm(alarm: Alarm): string {
  return alarm.isPM ? "PM" : "AM";
}

function formatDays(days: boolean[]): string {
  const selected = days
    .map((on, i) => (on ? DAY_LABELS[i] : null))
    .filter(Boolean);
  if (selected.length === 7) return "Every Day";
  if (selected.length === 0) return "Once";
  if (
    selected.length === 5 &&
    days[1] &&
    days[2] &&
    days[3] &&
    days[4] &&
    days[5]
  )
    return "Weekdays";
  if (selected.length === 2 && days[0] && days[6]) return "Weekends";
  return selected.join(", ");
}

export default function AlarmCard({ alarm, onToggle, onPress, onPermissionDenied }: AlarmCardProps) {
  const colors = useColors();

  const showVerse = alarm.alarmType === "verse" && !!alarm.verseRef;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, opacity: pressed ? 0.92 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.top}>
        <View>
          <Text style={[styles.days, { color: colors.mutedForeground }]}>
            {formatDays(alarm.days)}
          </Text>
          <View style={styles.timeRow}>
            <Text
              style={[
                styles.time,
                { color: alarm.enabled ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {formatTime(alarm)}
            </Text>
            <Text
              style={[
                styles.ampm,
                { color: alarm.enabled ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {" "}
              {formatAmPm(alarm)}
            </Text>
          </View>
        </View>
        <Switch
          value={alarm.enabled}
          onValueChange={() => {
            if (onPermissionDenied) {
              onPermissionDenied();
              return;
            }
            onToggle();
          }}
          trackColor={{ false: colors.border, true: colors.success }}
          thumbColor="#fff"
        />
      </View>
      <View style={styles.bottom}>
        <Text style={[styles.name, { color: colors.mutedForeground }]}>
          {alarm.name}
        </Text>
        {showVerse && (
          <>
            <Text style={[styles.dot, { color: colors.mutedForeground }]}>
              {" · "}
            </Text>
            <Image
              source={require("../assets/images/bible_1.png")}
              style={styles.bibleIcon}
              resizeMode="contain"
            />
            <Text style={[styles.verse, { color: colors.mutedForeground }]}>
              {" "}{alarm.verseRef}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  days: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  time: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.5,
  },
  ampm: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    marginBottom: 8,
  },
  bottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  dot: {
    fontSize: 13,
  },
  bibleIcon: {
    width: 14,
    height: 14,
  },
  verse: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});

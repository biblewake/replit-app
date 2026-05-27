import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { Alarm } from "@/context/AlarmContext";
import { BibleVerse, BIBLE_VERSES } from "@/constants/verses";
import BottomSheet from "@/components/BottomSheet";
import VersePickerSheet from "@/components/VersePickerSheet";
import { Ionicons } from "@expo/vector-icons";

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

interface AlarmEditSheetProps {
  visible: boolean;
  onClose: () => void;
  alarm?: Alarm | null;
  onSave: (alarm: Omit<Alarm, "id">) => void;
  onDelete?: () => void;
}

export default function AlarmEditSheet({
  visible,
  onClose,
  alarm,
  onSave,
  onDelete,
}: AlarmEditSheetProps) {
  const colors = useColors();
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [isPM, setIsPM] = useState(false);
  const [days, setDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [name, setName] = useState("Morning Alarm");
  const [verse, setVerse] = useState<BibleVerse>(BIBLE_VERSES[0]);
  const [showVersePicker, setShowVersePicker] = useState(false);

  useEffect(() => {
    if (alarm) {
      setHour(alarm.hour === 0 ? 12 : alarm.hour);
      setMinute(alarm.minute);
      setIsPM(alarm.isPM);
      setDays([...alarm.days]);
      setName(alarm.name);
      const found = BIBLE_VERSES.find((v) => v.ref === alarm.verseRef);
      if (found) setVerse(found);
    } else {
      setHour(7);
      setMinute(0);
      setIsPM(false);
      setDays([false, true, true, true, true, true, false]);
      setName("Morning Alarm");
      setVerse(BIBLE_VERSES[0]);
    }
  }, [alarm, visible]);

  const toggleDay = (i: number) => {
    Haptics.selectionAsync();
    const next = [...days];
    next[i] = !next[i];
    setDays(next);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    onClose();
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave({
      hour,
      minute,
      isPM,
      days,
      name: name.trim() || "Alarm",
      verseRef: verse.ref,
      verseText: verse.text,
      enabled: alarm?.enabled ?? true,
    });
    onClose();
  };

  return (
    <>
      <BottomSheet visible={visible && !showVersePicker} onClose={handleCancel} height={680}>
        <View style={styles.header}>
          <Pressable onPress={handleCancel} hitSlop={12}>
            <Text style={[styles.cancel, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {alarm ? "Edit Alarm" : "New Alarm"}
          </Text>
          <Pressable onPress={handleSave} hitSlop={12}>
            <Text style={[styles.save, { color: colors.foreground }]}>Save</Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={[styles.timePickerContainer, { backgroundColor: colors.secondary }]}>
            <View style={styles.timePickerRow}>
              <ScrollView
                style={styles.wheelScroll}
                showsVerticalScrollIndicator={false}
              >
                {HOURS.map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setHour(h);
                    }}
                    style={[
                      styles.wheelItem,
                      h === hour && {
                        backgroundColor: colors.card,
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.wheelText,
                        {
                          color: h === hour ? colors.foreground : colors.mutedForeground,
                          fontFamily: h === hour ? "Inter_700Bold" : "Inter_400Regular",
                        },
                      ]}
                    >
                      {h}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
              <ScrollView
                style={styles.wheelScroll}
                showsVerticalScrollIndicator={false}
              >
                {MINUTES.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setMinute(m);
                    }}
                    style={[
                      styles.wheelItem,
                      m === minute && {
                        backgroundColor: colors.card,
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.wheelText,
                        {
                          color: m === minute ? colors.foreground : colors.mutedForeground,
                          fontFamily: m === minute ? "Inter_700Bold" : "Inter_400Regular",
                        },
                      ]}
                    >
                      {m.toString().padStart(2, "0")}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.ampmColumn}>
                {["AM", "PM"].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setIsPM(p === "PM");
                    }}
                    style={[
                      styles.ampmBtn,
                      {
                        backgroundColor:
                          (p === "PM") === isPM ? colors.card : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ampmText,
                        {
                          color:
                            (p === "PM") === isPM
                              ? colors.foreground
                              : colors.mutedForeground,
                          fontFamily:
                            (p === "PM") === isPM
                              ? "Inter_700Bold"
                              : "Inter_400Regular",
                        },
                      ]}
                    >
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            REPEAT
          </Text>
          <View style={styles.daysRow}>
            {DAY_LETTERS.map((letter, i) => (
              <Pressable
                key={i}
                onPress={() => toggleDay(i)}
                style={[
                  styles.dayBtn,
                  {
                    backgroundColor: days[i] ? colors.foreground : colors.secondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayBtnText,
                    {
                      color: days[i] ? colors.primaryForeground : colors.mutedForeground,
                    },
                  ]}
                >
                  {letter}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            LABEL
          </Text>
          <View style={[styles.inputRow, { backgroundColor: colors.secondary }]}>
            <TextInput
              style={[
                styles.input,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Alarm name"
              placeholderTextColor={colors.mutedForeground}
            />
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            BIBLE VERSE
          </Text>
          <Pressable
            style={[styles.verseRow, { backgroundColor: colors.secondary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowVersePicker(true);
            }}
          >
            <View style={styles.verseRowContent}>
              <Ionicons name="book" size={18} color={colors.foreground} />
              <View style={styles.verseInfo}>
                <Text style={[styles.verseRef, { color: colors.foreground }]}>
                  {verse.ref}
                </Text>
                <Text
                  style={[styles.versePreview, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {verse.text}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>

          {onDelete && (
            <Pressable
              style={[styles.deleteBtn, { borderColor: colors.destructive + "40" }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
                onDelete();
                onClose();
              }}
            >
              <Text style={[styles.deleteTxt, { color: colors.destructive }]}>
                Delete Alarm
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </BottomSheet>

      <VersePickerSheet
        visible={showVersePicker}
        onClose={() => setShowVersePicker(false)}
        onSelect={(v) => setVerse(v)}
        selectedRef={verse.ref}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  cancel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  save: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
    gap: 8,
  },
  timePickerContainer: {
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  timePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 140,
    justifyContent: "center",
    gap: 4,
  },
  wheelScroll: {
    flex: 1,
    maxHeight: 140,
  },
  wheelItem: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  wheelText: {
    fontSize: 22,
  },
  colon: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    paddingHorizontal: 4,
  },
  ampmColumn: {
    gap: 8,
    paddingLeft: 8,
  },
  ampmBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ampmText: {
    fontSize: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  daysRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  dayBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  inputRow: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
  },
  verseRow: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verseRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  verseInfo: {
    flex: 1,
  },
  verseRef: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  versePreview: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  deleteBtn: {
    marginTop: 24,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  deleteTxt: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});

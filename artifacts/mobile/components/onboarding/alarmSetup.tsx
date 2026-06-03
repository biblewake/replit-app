import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { BibleVerse, BIBLE_VERSES } from "@/constants/verses";
import {
  ALARM_SOUNDS,
  SOUND_CATEGORIES,
  SoundCategory,
  getSoundsByCategory,
} from "@/constants/alarmSounds";
import { OL, ONBOARDING_ORANGE } from "@/components/onboarding/primitives";

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WakeTime {
  hour: number;
  minute: number;
  isPM: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const AMPM = ["AM", "PM"];

/* ── Wheel column — snap picker, fixed double-fire on drag end ──────────── */
function WheelColumn({
  items,
  selectedIndex,
  onSelect,
  formatItem,
}: {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatItem?: (item: string | number) => string;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);
  const handled = useRef(false);
  const lastIndexRef = useRef(selectedIndex);

  useEffect(() => {
    if (!isScrolling.current) {
      scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
    }
  }, [selectedIndex]);

  const handleScrollBeginDrag = () => {
    isScrolling.current = true;
    handled.current = false;
  };

  const handleScrollMove = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    if (clamped !== lastIndexRef.current) {
      lastIndexRef.current = clamped;
      Haptics.selectionAsync();
    }
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (handled.current) return;
    handled.current = true;
    isScrolling.current = false;
    const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    if (clamped !== selectedIndex) {
      Haptics.selectionAsync();
      onSelect(clamped);
    }
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={{ height: PICKER_HEIGHT, flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScroll={handleScrollMove}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={16}
      >
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          const label = formatItem ? formatItem(item) : String(item);
          return (
            <Pressable
              key={i}
              style={styles.wheelItem}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(i);
                scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
              }}
            >
              <Text
                style={[
                  styles.wheelText,
                  {
                    color: isSelected ? OL.foreground : OL.mutedForeground,
                    fontFamily: isSelected ? "Inter_700Bold" : "Inter_400Regular",
                    opacity: isSelected ? 1 : 0.4,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ── Step 19: Time picker ─────────────────────────────────────────────────── */
export function TimePicker({
  value,
  onChange,
}: {
  value: WakeTime;
  onChange: (t: WakeTime) => void;
}) {
  return (
    <View style={styles.timeWrap}>
      <View
        style={[styles.timeHighlight, { backgroundColor: OL.secondary }]}
        pointerEvents="none"
      />
      <View style={styles.wheelRow}>
        <WheelColumn
          items={HOURS}
          selectedIndex={value.hour - 1}
          onSelect={(i) => onChange({ ...value, hour: HOURS[i] })}
        />
        <Text style={[styles.colon, { color: OL.foreground }]}>:</Text>
        <WheelColumn
          items={MINUTES}
          selectedIndex={value.minute}
          onSelect={(i) => onChange({ ...value, minute: MINUTES[i] })}
          formatItem={(m) => String(m).padStart(2, "0")}
        />
        <WheelColumn
          items={AMPM}
          selectedIndex={value.isPM ? 1 : 0}
          onSelect={(i) => onChange({ ...value, isPM: i === 1 })}
        />
      </View>
    </View>
  );
}

/* ── Step 20: Day-of-week grid ────────────────────────────────────────────── */
export function DaysGrid({
  days,
  onChange,
}: {
  days: boolean[];
  onChange: (days: boolean[]) => void;
}) {
  const toggle = (i: number) => {
    Haptics.selectionAsync();
    const next = [...days];
    next[i] = !next[i];
    onChange(next);
  };
  return (
    <View style={styles.daysGrid}>
      {DAY_LETTERS.map((letter, i) => {
        const active = days[i];
        return (
          <Pressable
            key={i}
            onPress={() => toggle(i)}
            style={[
              styles.dayChip,
              {
                backgroundColor: active ? ONBOARDING_ORANGE : OL.card,
                borderColor: active ? ONBOARDING_ORANGE : OL.border,
              },
            ]}
          >
            <Text
              style={[
                styles.dayChipText,
                { color: active ? "#FFFFFF" : OL.mutedForeground },
              ]}
            >
              {letter}
            </Text>
            <Text
              style={[
                styles.dayChipSub,
                { color: active ? "rgba(255,255,255,0.85)" : OL.mutedForeground },
              ]}
            >
              {DAY_NAMES[i]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Step 21: Multi-stage verse picker ────────────────────────────────────── */
type VerseStage = "mode" | "source" | "library" | "custom";

export function VersePickerInline({
  selectedRef,
  onSelect,
}: {
  selectedRef?: string;
  onSelect: (verse: BibleVerse, mode: "memory" | "declare") => void;
}) {
  const [stage, setStage] = useState<VerseStage>("mode");
  const [mode, setMode] = useState<"memory" | "declare">("memory");
  const [search, setSearch] = useState("");
  const [customRef, setCustomRef] = useState("");
  const [customText, setCustomText] = useState("");

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const transition = (nextStage: VerseStage) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setStage(nextStage);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  };

  const selectMode = (m: "memory" | "declare") => {
    Haptics.selectionAsync();
    setMode(m);
    transition("source");
  };

  const selectSource = (src: "library" | "custom") => {
    Haptics.selectionAsync();
    transition(src);
  };

  const filtered = BIBLE_VERSES.filter(
    (v) =>
      !search ||
      v.ref.toLowerCase().includes(search.toLowerCase()) ||
      v.text.toLowerCase().includes(search.toLowerCase())
  );

  const modeDescriptions = {
    memory: {
      emoji: "🧠",
      title: "Memorize",
      description: "Recite the verse from memory to dismiss your alarm. Best for building lasting scripture retention.",
    },
    declare: {
      emoji: "📖",
      title: "Declare",
      description: "Read the verse aloud to dismiss your alarm. Great for starting the day with intentional scripture.",
    },
  } as const;

  return (
    <Animated.View
      style={[{ flex: 1 }, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
    >
      {/* Stage 1: Mode selection */}
      {stage === "mode" && (
        <View style={{ flex: 1, gap: 16 }}>
          <Text style={[styles.stageHint, { color: OL.mutedForeground }]}>
            How will you use your verse?
          </Text>
          {(["memory", "declare"] as const).map((m) => {
            const d = modeDescriptions[m];
            return (
              <Pressable
                key={m}
                onPress={() => selectMode(m)}
                style={({ pressed }) => [
                  styles.modeCard,
                  {
                    backgroundColor: OL.card,
                    borderColor: mode === m ? ONBOARDING_ORANGE : OL.border,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Text style={styles.modeEmoji}>{d.emoji}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[styles.modeTitle, { color: OL.foreground }]}>{d.title}</Text>
                  <Text style={[styles.modeDesc, { color: OL.mutedForeground }]}>{d.description}</Text>
                </View>
                <View
                  style={[
                    styles.modeArrow,
                    { backgroundColor: ONBOARDING_ORANGE },
                  ]}
                >
                  <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Stage 2: Source selection */}
      {stage === "source" && (
        <View style={{ flex: 1, gap: 16 }}>
          <Pressable onPress={() => transition("mode")} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={OL.mutedForeground} />
            <Text style={[styles.backBtnText, { color: OL.mutedForeground }]}>Back</Text>
          </Pressable>
          <Text style={[styles.stageHint, { color: OL.mutedForeground }]}>
            Where is your verse from?
          </Text>
          {[
            { src: "library" as const, emoji: "📚", title: "Choose from library", desc: "Pick from our curated collection of scripture." },
            { src: "custom" as const, emoji: "✍️", title: "Enter your own verse", desc: "Type in any Bible verse of your choice." },
          ].map(({ src, emoji, title, desc }) => (
            <Pressable
              key={src}
              onPress={() => selectSource(src)}
              style={({ pressed }) => [
                styles.modeCard,
                { backgroundColor: OL.card, borderColor: OL.border, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Text style={styles.modeEmoji}>{emoji}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.modeTitle, { color: OL.foreground }]}>{title}</Text>
                <Text style={[styles.modeDesc, { color: OL.mutedForeground }]}>{desc}</Text>
              </View>
              <View style={[styles.modeArrow, { backgroundColor: OL.border }]}>
                <Ionicons name="chevron-forward" size={16} color={OL.mutedForeground} />
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Stage 3a: Library */}
      {stage === "library" && (
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => transition("source")} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={OL.mutedForeground} />
            <Text style={[styles.backBtnText, { color: OL.mutedForeground }]}>Back</Text>
          </Pressable>
          <View style={[styles.searchBox, { backgroundColor: OL.card, borderColor: OL.border }]}>
            <Ionicons name="search" size={18} color={OL.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search verses"
              placeholderTextColor={OL.mutedForeground}
              style={[styles.searchInput, { color: OL.foreground }]}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(v) => v.ref}
            keyboardShouldPersistTaps="handled"
            style={styles.verseList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const selected = item.ref === selectedRef;
              return (
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    onSelect(item, mode);
                  }}
                  style={[
                    styles.verseRow,
                    { backgroundColor: OL.card, borderColor: selected ? ONBOARDING_ORANGE : OL.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.verseRef, { color: OL.foreground }]}>{item.ref}</Text>
                    <Text numberOfLines={2} style={[styles.verseText, { color: OL.mutedForeground }]}>
                      {item.text}
                    </Text>
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={ONBOARDING_ORANGE} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* Stage 3b: Custom input */}
      {stage === "custom" && (
        <View style={{ flex: 1, gap: 16 }}>
          <Pressable onPress={() => transition("source")} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={18} color={OL.mutedForeground} />
            <Text style={[styles.backBtnText, { color: OL.mutedForeground }]}>Back</Text>
          </Pressable>
          <View style={{ gap: 12 }}>
            <Text style={[styles.stageHint, { color: OL.mutedForeground }]}>Verse reference</Text>
            <TextInput
              value={customRef}
              onChangeText={setCustomRef}
              placeholder="e.g. John 3:16"
              placeholderTextColor={OL.mutedForeground}
              style={[styles.customInput, { backgroundColor: OL.card, borderColor: OL.border, color: OL.foreground }]}
            />
            <Text style={[styles.stageHint, { color: OL.mutedForeground, marginTop: 4 }]}>Verse text</Text>
            <TextInput
              value={customText}
              onChangeText={setCustomText}
              placeholder="For God so loved the world..."
              placeholderTextColor={OL.mutedForeground}
              style={[
                styles.customInput,
                styles.customTextArea,
                { backgroundColor: OL.card, borderColor: OL.border, color: OL.foreground },
              ]}
              multiline
              textAlignVertical="top"
            />
          </View>
          <Pressable
            disabled={!customRef.trim() || !customText.trim()}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect({ ref: customRef.trim(), text: customText.trim(), category: "Custom" }, mode);
            }}
            style={({ pressed }) => [
              styles.useVerseBtn,
              {
                backgroundColor:
                  customRef.trim() && customText.trim() ? ONBOARDING_ORANGE : OL.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={styles.useVerseBtnText}>Use this verse</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}

/* ── Step 22: Inline sound picker ─────────────────────────────────────────── */
export function SoundPickerInline({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [category, setCategory] = useState<SoundCategory>("bright");
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      }).catch(() => {});
    }
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const preview = async (source: number, id: string) => {
    Haptics.selectionAsync();
    onSelect(id);
    if (Platform.OS === "web") return;
    try {
      await soundRef.current?.stopAsync().catch(() => {});
      await soundRef.current?.unloadAsync().catch(() => {});
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        volume: 1,
      });
      soundRef.current = sound;
      setTimeout(() => {
        sound.stopAsync().catch(() => {});
      }, 3000);
    } catch {
      // preview is best-effort
    }
  };

  const sounds = getSoundsByCategory(category);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {SOUND_CATEGORIES.map((c) => {
          const active = c.id === category;
          return (
            <Pressable
              key={c.id}
              onPress={() => {
                Haptics.selectionAsync();
                setCategory(c.id);
              }}
              style={[
                styles.catChip,
                {
                  backgroundColor: active ? ONBOARDING_ORANGE : OL.card,
                  borderColor: active ? ONBOARDING_ORANGE : OL.border,
                },
              ]}
            >
              <Text style={{ fontSize: 14 }}>{c.emoji}</Text>
              <Text
                style={[
                  styles.catChipText,
                  { color: active ? "#FFFFFF" : OL.foreground },
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled
        style={styles.soundScrollList}
      >
        {sounds.map((item) => {
          const selected = item.id === selectedId;
          return (
            <Pressable
              key={item.id}
              onPress={() => preview(item.source, item.id)}
              style={[
                styles.soundRow,
                { backgroundColor: OL.card, borderColor: selected ? ONBOARDING_ORANGE : OL.border },
              ]}
            >
              <Ionicons
                name={selected ? "volume-high" : "musical-note"}
                size={20}
                color={selected ? ONBOARDING_ORANGE : OL.mutedForeground}
              />
              <Text style={[styles.soundLabel, { color: OL.foreground }]}>{item.label}</Text>
              {selected ? (
                <Ionicons name="checkmark-circle" size={22} color={ONBOARDING_ORANGE} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  timeWrap: {
    height: PICKER_HEIGHT,
    justifyContent: "center",
  },
  timeHighlight: {
    position: "absolute",
    left: 12,
    right: 12,
    height: ITEM_HEIGHT,
    top: PICKER_HEIGHT / 2 - ITEM_HEIGHT / 2,
    borderRadius: 14,
  },
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  colon: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginHorizontal: 2,
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    fontSize: 26,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  dayChip: {
    width: 64,
    height: 72,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dayChipText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  dayChipSub: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  stageHint: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  modeEmoji: {
    fontSize: 28,
  },
  modeTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  modeDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  modeArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  backBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  verseList: {
    flex: 1,
  },
  soundScrollList: {
    maxHeight: 340,
  },
  verseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  verseRef: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    marginBottom: 3,
  },
  verseText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  customInput: {
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  customTextArea: {
    height: 120,
    paddingTop: 14,
  },
  useVerseBtn: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  useVerseBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  catRow: {
    gap: 10,
    paddingBottom: 14,
    paddingRight: 8,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  catChipText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  soundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  soundLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
});

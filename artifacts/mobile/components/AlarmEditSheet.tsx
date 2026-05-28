import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Alarm } from "@/context/AlarmContext";
import { BibleVerse, BIBLE_VERSES } from "@/constants/verses";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const USE_NATIVE_DRIVER = Platform.OS !== "web";
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const AMPM = ["AM", "PM"];
const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

type PanelType = "time" | "verse" | "wakeup" | "sound";

const PANEL_HEIGHTS: Record<PanelType, number> = {
  time: 480,
  verse: SCREEN_HEIGHT * 0.88,
  wakeup: 560,
  sound: SCREEN_HEIGHT * 0.85,
};

const PANEL_TITLES: Record<PanelType, string> = {
  time: "Set Time",
  verse: "Choose a Verse",
  wakeup: "Wake-up Check",
  sound: "Alarm Sound",
};

function GlassClose({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <BlurView
        intensity={65}
        tint="light"
        style={styles.glassClose}
      >
        <Ionicons name="close" size={14} color="rgba(0,0,0,0.6)" />
      </BlurView>
    </Pressable>
  );
}

interface WheelColumnProps {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatItem?: (item: string | number) => string;
}

function WheelColumn({ items, selectedIndex, onSelect, formatItem }: WheelColumnProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const lastIndexRef = useRef(selectedIndex);
  const isScrolling = useRef(false);

  useEffect(() => {
    if (!isScrolling.current) {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const handleScrollEvent = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    if (clamped !== lastIndexRef.current) {
      lastIndexRef.current = clamped;
      Haptics.selectionAsync();
    }
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    isScrolling.current = false;
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    if (clamped !== selectedIndex) {
      Haptics.selectionAsync();
      onSelect(clamped);
    }
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
  };

  return (
    <View style={styles.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onScroll={handleScrollEvent}
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
                    color: isSelected ? colors.foreground : colors.mutedForeground,
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

interface AlarmEditSheetProps {
  visible: boolean;
  onClose: () => void;
  alarm?: Alarm | null;
  onSave: (alarm: Omit<Alarm, "id">) => void;
  onDelete?: () => void;
  alarmType?: "verse" | "normal";
}

export default function AlarmEditSheet({
  visible,
  onClose,
  alarm,
  onSave,
  onDelete,
  alarmType: propAlarmType,
}: AlarmEditSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const mainTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const panelBackdropOpacity = useRef(new Animated.Value(0)).current;

  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [isPM, setIsPM] = useState(false);
  const [days, setDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
  const [name, setName] = useState("Morning Alarm");
  const [verse, setVerse] = useState<BibleVerse>(BIBLE_VERSES[0]);
  const [scheduleType, setScheduleType] = useState<"scheduled" | "one-time">("scheduled");
  const [wakeUpCheck, setWakeUpCheck] = useState(false);
  const [alarmType, setAlarmType] = useState<"verse" | "normal">(propAlarmType ?? "verse");

  const [activePanelType, setActivePanelType] = useState<PanelType | null>(null);
  const [verseSearch, setVerseSearch] = useState("");

  useEffect(() => {
    if (visible) {
      if (alarm) {
        setHour(alarm.hour === 0 ? 12 : alarm.hour);
        setMinute(alarm.minute);
        setIsPM(alarm.isPM);
        setDays([...alarm.days]);
        setName(alarm.name);
        const found = BIBLE_VERSES.find((v) => v.ref === alarm.verseRef);
        if (found) setVerse(found);
        setScheduleType(alarm.scheduleType ?? "scheduled");
        setWakeUpCheck(alarm.wakeUpCheck ?? false);
        setAlarmType(alarm.alarmType ?? propAlarmType ?? "verse");
      } else {
        setHour(7);
        setMinute(0);
        setIsPM(false);
        setDays([false, true, true, true, true, true, false]);
        setName("Morning Alarm");
        setVerse(BIBLE_VERSES[0]);
        setScheduleType("scheduled");
        setWakeUpCheck(false);
        setAlarmType(propAlarmType ?? "verse");
      }
    }
  }, [alarm, visible, propAlarmType]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(mainTranslateY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.poly(4)),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(mainTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
  }, [visible]);

  const openPanel = useCallback((type: PanelType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    panelTranslateY.setValue(SCREEN_HEIGHT);
    panelBackdropOpacity.setValue(0);
    setActivePanelType(type);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(panelTranslateY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.poly(4)),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(panelBackdropOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    });
  }, []);

  const closePanel = useCallback(() => {
    Animated.parallel([
      Animated.timing(panelTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(panelBackdropOpacity, {
        toValue: 0,
        duration: 240,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setActivePanelType(null);
        setVerseSearch("");
      }
    });
  }, []);

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
      alarmType,
      scheduleType,
      wakeUpCheck,
    });
    onClose();
  };

  const formatTime = () => {
    const h = hour === 0 ? 12 : hour;
    const m = minute.toString().padStart(2, "0");
    return `${h}:${m} ${isPM ? "PM" : "AM"}`;
  };

  const sheetHeight = SCREEN_HEIGHT - insets.top - 16;

  const hourIndex = Math.max(0, HOURS.indexOf(hour === 0 ? 12 : hour));
  const minuteIndex = minute;
  const ampmIndex = isPM ? 1 : 0;

  const filteredVerses = BIBLE_VERSES.filter((v) => {
    if (!verseSearch) return true;
    const q = verseSearch.toLowerCase();
    return v.ref.toLowerCase().includes(q) || v.text.toLowerCase().includes(q);
  });

  const renderPanelContent = () => {
    if (!activePanelType) return null;

    switch (activePanelType) {
      case "time":
        return (
          <View style={styles.panelBody}>
            <View style={[styles.pickerContainer, { backgroundColor: colors.secondary }]}>
              <View
                style={[styles.pickerHighlight, { backgroundColor: colors.card }]}
                pointerEvents="none"
              />
              <View style={styles.pickerRow}>
                <WheelColumn
                  items={HOURS}
                  selectedIndex={hourIndex}
                  onSelect={(i) => setHour(HOURS[i])}
                  formatItem={(h) => String(h)}
                />
                <View style={styles.colonWrap} pointerEvents="none">
                  <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
                </View>
                <WheelColumn
                  items={MINUTES}
                  selectedIndex={minuteIndex}
                  onSelect={(i) => setMinute(MINUTES[i])}
                  formatItem={(m) => String(m).padStart(2, "0")}
                />
                <View style={styles.ampmSpacer} />
                <WheelColumn
                  items={AMPM}
                  selectedIndex={ampmIndex}
                  onSelect={(i) => setIsPM(i === 1)}
                />
              </View>
            </View>
            <Pressable
              style={[styles.doneBtn, { marginTop: 20, backgroundColor: "#1C1C1E" }]}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                closePanel();
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        );

      case "verse":
        return (
          <View style={[styles.versePanelBody, { flex: 1 }]}>
            <View
              style={[
                styles.searchRow,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder="Search verses..."
                placeholderTextColor={colors.mutedForeground}
                value={verseSearch}
                onChangeText={setVerseSearch}
              />
              {verseSearch ? (
                <Pressable onPress={() => setVerseSearch("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            <FlatList
              data={filteredVerses}
              keyExtractor={(v) => v.ref}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.verseList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.ref === verse.ref;
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.verseItem,
                      {
                        backgroundColor: isSelected
                          ? colors.primary + "10"
                          : pressed
                          ? colors.secondary
                          : "transparent",
                        borderBottomColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setVerse(item);
                      closePanel();
                    }}
                  >
                    <View style={styles.verseItemTop}>
                      <View
                        style={[
                          styles.categoryBadge,
                          { backgroundColor: colors.secondary },
                        ]}
                      >
                        <Text
                          style={[styles.categoryText, { color: colors.mutedForeground }]}
                        >
                          {item.category}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={colors.primary}
                        />
                      )}
                    </View>
                    <Text style={[styles.verseRef, { color: colors.foreground }]}>
                      {item.ref}
                    </Text>
                    <Text
                      style={[styles.verseText, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {item.text}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        );

      case "wakeup":
        return (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.wakeupBody}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.wakeupSubtitle, { color: colors.mutedForeground }]}>
              A second alarm 10 minutes after the first — so you can't just go back to sleep.
            </Text>

            <View style={styles.wakeupFeatures}>
              <View style={styles.wakeupFeatureRow}>
                <View style={[styles.featureIconCircle, { backgroundColor: "#FF6B0015" }]}>
                  <Ionicons name="flash" size={22} color="#FF6B00" />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                    Mental Challenge
                  </Text>
                  <Text style={[styles.featureSubtitle, { color: colors.mutedForeground }]}>
                    You have to type a quick phrase to prove you're awake.
                  </Text>
                </View>
              </View>

              <View style={[styles.featureDivider, { backgroundColor: colors.border }]} />

              <View style={styles.wakeupFeatureRow}>
                <View style={[styles.featureIconCircle, { backgroundColor: "#34C75915" }]}>
                  <Ionicons name="shield-checkmark" size={22} color="#34C759" />
                </View>
                <View style={styles.featureText}>
                  <Text style={[styles.featureTitle, { color: colors.foreground }]}>
                    Snooze Protection
                  </Text>
                  <Text style={[styles.featureSubtitle, { color: colors.mutedForeground }]}>
                    Prevents accidental dismissal while still half-asleep, a second alarm goes off 10 minutes later to make sure you really got up.
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              style={[
                styles.toggleRow,
                { backgroundColor: colors.secondary },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setWakeUpCheck((v) => !v);
              }}
            >
              <View style={styles.toggleLabel}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={wakeUpCheck ? colors.success : colors.mutedForeground}
                />
                <Text style={[styles.toggleText, { color: colors.foreground }]}>
                  Enable Wake-up Check
                </Text>
              </View>
              <Switch
                value={wakeUpCheck}
                onValueChange={(val) => {
                  Haptics.selectionAsync();
                  setWakeUpCheck(val);
                }}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor="#fff"
              />
            </Pressable>

            <Pressable
              style={[
                styles.doneBtn,
                { backgroundColor: "#1C1C1E", marginBottom: Math.max(insets.bottom, 16) + 8 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                closePanel();
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </ScrollView>
        );

      case "sound":
        return (
          <View style={[styles.panelBody, { flex: 1, justifyContent: "space-between" }]}>
            <View style={[styles.emptyState, { backgroundColor: colors.secondary }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.border }]}>
                <Ionicons name="musical-notes" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No sounds yet
              </Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                Sound selection will be available in a future update.
              </Text>
            </View>
            <Pressable
              style={[
                styles.doneBtn,
                { backgroundColor: "#1C1C1E", marginBottom: Math.max(insets.bottom, 16) + 8 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                closePanel();
              }}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />

        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: colors.background,
              transform: [{ translateY: mainTranslateY }],
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <GlassClose onPress={handleCancel} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {alarm ? "Edit Alarm" : "New Alarm"}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>LABEL</Text>
              <View style={styles.card}>
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Alarm name"
                  placeholderTextColor={colors.mutedForeground}
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>TIME</Text>
              <Pressable
                style={[styles.card, styles.rowCard]}
                onPress={() => openPanel("time")}
              >
                <View style={[styles.rowIconBg, { backgroundColor: colors.blue + "18" }]}>
                  <Ionicons name="time-outline" size={18} color={colors.blue} />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Alarm Time</Text>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                    {formatTime()}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </View>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SCHEDULE</Text>
              <View style={[styles.card, styles.segmentedContainer]}>
                {(["scheduled", "one-time"] as const).map((type) => {
                  const isActive = scheduleType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[
                        styles.segmentBtn,
                        isActive && styles.segmentBtnActive,
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setScheduleType(type);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          {
                            color: isActive ? "#FFFFFF" : colors.mutedForeground,
                            fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                          },
                        ]}
                      >
                        {type === "scheduled" ? "Scheduled" : "One-time"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {scheduleType === "scheduled" && (
              <View style={styles.section}>
                <View style={styles.sectionLabelRow}>
                  <Ionicons name="repeat" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                    {"  "}REPEAT ON
                  </Text>
                </View>
                <View style={styles.card}>
                  <View style={styles.daysRow}>
                    {DAY_LETTERS.map((letter, i) => (
                      <Pressable
                        key={i}
                        onPress={() => toggleDay(i)}
                        style={[
                          styles.dayBtn,
                          {
                            backgroundColor: days[i] ? colors.foreground : "transparent",
                            borderColor: days[i] ? colors.foreground : "#E2E9F1",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayBtnText,
                            {
                              color: days[i] ? "#FFFFFF" : colors.mutedForeground,
                            },
                          ]}
                        >
                          {letter}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {alarmType === "verse" && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  BIBLE VERSE
                </Text>
                <Pressable
                  style={[styles.card, styles.rowCard]}
                  onPress={() => openPanel("verse")}
                >
                  <View style={[styles.rowIconBg, { backgroundColor: "#FF6B0018" }]}>
                    <Ionicons name="book-outline" size={18} color="#FF6B00" />
                  </View>
                  <View style={styles.verseRowInner}>
                    <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                      {verse.ref}
                    </Text>
                    <Text
                      style={[styles.verseRowPreview, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {verse.text}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OPTIONS</Text>
              <Pressable
                style={[styles.card, styles.rowCard]}
                onPress={() => openPanel("sound")}
              >
                <View style={[styles.rowIconBg, { backgroundColor: "#AF52DE18" }]}>
                  <Ionicons name="musical-notes-outline" size={18} color="#AF52DE" />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Sound</Text>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>Default</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </View>
              </Pressable>

              <View style={{ height: 10 }} />

              <Pressable
                style={[styles.card, styles.rowCard]}
                onPress={() => openPanel("wakeup")}
              >
                <View style={[styles.rowIconBg, { backgroundColor: "#34C75918" }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#34C759" />
                </View>
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                  Wake-up Check
                </Text>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
                    {wakeUpCheck ? "On" : "Off"}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </View>
              </Pressable>
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                backgroundColor: colors.background,
              },
            ]}
          >
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.foreground }]}
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                Save Alarm
              </Text>
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
                <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
                  Delete Alarm
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        {activePanelType && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View
              style={[StyleSheet.absoluteFill, { opacity: panelBackdropOpacity }]}
              pointerEvents="auto"
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={closePanel} />
            </Animated.View>

            <Animated.View
              style={[
                styles.panelCard,
                {
                  height: PANEL_HEIGHTS[activePanelType],
                  backgroundColor: colors.card,
                  transform: [{ translateY: panelTranslateY }],
                },
              ]}
            >
              <View style={styles.panelGrabber} />
              <View style={styles.panelHeader}>
                <GlassClose onPress={closePanel} />
                <Text style={[styles.panelTitle, { color: colors.foreground }]}>
                  {PANEL_TITLES[activePanelType]}
                </Text>
                <View style={styles.headerSpacer} />
              </View>
              {renderPanelContent()}
            </Animated.View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    elevation: 24,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sheetTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 30,
  },
  glassClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowIconBg: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxWidth: 140,
    textAlign: "right",
  },
  verseRowInner: {
    flex: 1,
  },
  verseRowPreview: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  input: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  segmentedContainer: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#1C1C1E",
  },
  segmentText: {
    fontSize: 14,
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  dayBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  saveBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  panelCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    elevation: 30,
    overflow: "hidden",
  },
  panelGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D1D6",
    alignSelf: "center",
    marginBottom: 8,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  panelTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    marginHorizontal: 8,
  },
  panelBody: {
    paddingHorizontal: 20,
  },
  pickerContainer: {
    height: PICKER_HEIGHT,
    overflow: "hidden",
    borderRadius: 20,
    position: "relative",
  },
  pickerHighlight: {
    position: "absolute",
    left: 16,
    right: 16,
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    zIndex: 0,
  },
  pickerRow: {
    flexDirection: "row",
    height: PICKER_HEIGHT,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  wheelColumn: {
    flex: 1,
    height: PICKER_HEIGHT,
    overflow: "hidden",
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    fontSize: 26,
  },
  colonWrap: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  colon: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  ampmSpacer: {
    width: 8,
  },
  doneBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  versePanelBody: {
    paddingHorizontal: 20,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  verseList: {
    paddingBottom: 40,
  },
  verseItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  verseItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
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
  wakeupBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  wakeupSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  wakeupFeatures: {
    gap: 0,
  },
  wakeupFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 14,
  },
  featureIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 3,
  },
  featureSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  featureDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 64,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  toggleLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  toggleText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  emptyState: {
    borderRadius: 16,
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 220,
  },
});

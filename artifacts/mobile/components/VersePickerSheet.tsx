import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { BibleVerse, BIBLE_VERSES } from "@/constants/verses";
import BottomSheet from "@/components/BottomSheet";
import { Ionicons } from "@expo/vector-icons";

type VerseMode = "memory" | "declare";

interface VersePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (verse: BibleVerse, mode: VerseMode) => void;
  selectedRef?: string;
}

const USE_NATIVE_DRIVER = Platform.OS !== "web";

const MODE_CARDS: {
  mode: VerseMode;
  emoji: string;
  title: string;
  subtitle: string;
  bg: string;
}[] = [
  {
    mode: "memory",
    emoji: "🧠",
    title: "Memorize",
    subtitle: "Recite from memory — no peeking at the text",
    bg: "#4F46E5",
  },
  {
    mode: "declare",
    emoji: "📖",
    title: "Declare",
    subtitle: "Read aloud while following along with the words",
    bg: "#0891B2",
  },
];

export default function VersePickerSheet({
  visible,
  onClose,
  onSelect,
  selectedRef,
}: VersePickerSheetProps) {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [step, setStep] = useState<"mode" | "verse">("mode");
  const [chosenMode, setChosenMode] = useState<VerseMode | null>(null);
  const [pressedMode, setPressedMode] = useState<VerseMode | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  const filtered = BIBLE_VERSES.filter((v) => {
    const matchesSearch =
      !search ||
      v.ref.toLowerCase().includes(search.toLowerCase()) ||
      v.text.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !activeCategory || v.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    onClose();
  };

  const resetStepState = () => {
    setStep("mode");
    setChosenMode(null);
    setSearch("");
    setActiveCategory(null);
    fadeAnim.setValue(0);
    slideAnim.setValue(16);
  };

  const handleModeSelect = (mode: VerseMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPressedMode(mode);
    setTimeout(() => {
      setPressedMode(null);
      setChosenMode(mode);
      setStep("verse");
      fadeAnim.setValue(0);
      slideAnim.setValue(16);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }, 120);
  };

  const handleChangeModePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fadeAnim.setValue(0);
    slideAnim.setValue(16);
    setStep("mode");
    setChosenMode(null);
  };

  const modeLabel =
    chosenMode === "memory"
      ? "🧠 Memorize"
      : chosenMode === "declare"
      ? "📖 Declare"
      : "";

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        resetStepState();
        handleClose();
      }}
      height={680}
      showCloseButton={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {step === "mode" ? "How will you engage?" : "Choose a Verse"}
        </Text>
        <Pressable
          onPress={() => {
            resetStepState();
            handleClose();
          }}
          hitSlop={4}
        >
          <BlurView intensity={65} tint="light" style={styles.glassClose}>
            <Ionicons name="close" size={20} color="rgba(0,0,0,0.55)" />
          </BlurView>
        </Pressable>
      </View>

      {step === "mode" ? (
        <View style={styles.modeContainer}>
          {MODE_CARDS.map((card) => {
            const isPressed = pressedMode === card.mode;
            return (
              <Pressable
                key={card.mode}
                onPress={() => handleModeSelect(card.mode)}
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: card.bg,
                    opacity: isPressed ? 0.82 : 1,
                    transform: [{ scale: isPressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Text style={styles.modeEmoji}>{card.emoji}</Text>
                <Text style={styles.modeTitle}>{card.title}</Text>
                <Text style={styles.modeSubtitle}>{card.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Animated.View
          style={[
            styles.verseStepContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Pressable
            onPress={handleChangeModePress}
            style={[styles.modePill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          >
            <Text style={[styles.modePillText, { color: colors.foreground }]}>
              {modeLabel}
            </Text>
            <Ionicons name="chevron-back" size={13} color={colors.mutedForeground} />
            <Text style={[styles.modePillChange, { color: colors.mutedForeground }]}>
              change
            </Text>
          </Pressable>

          <View
            style={[
              styles.searchRow,
              { backgroundColor: colors.secondary, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[
                styles.searchInput,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
              placeholder="Search verses..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(v) => v.ref}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = item.ref === selectedRef;
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
                    onSelect(item, chosenMode!);
                    resetStepState();
                    onClose();
                  }}
                >
                  <View style={styles.verseTop}>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: colors.secondary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryText,
                          { color: colors.mutedForeground },
                        ]}
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
        </Animated.View>
      )}
    </BottomSheet>
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
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  modeContainer: {
    paddingHorizontal: 20,
    gap: 14,
    flex: 1,
    paddingBottom: 32,
  },
  modeCard: {
    flex: 1,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  modeEmoji: {
    fontSize: 48,
  },
  modeTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  modeSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.80)",
    textAlign: "center",
    lineHeight: 20,
  },
  verseStepContainer: {
    flex: 1,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  modePillText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  modePillChange: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  glassClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  verseItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  verseTop: {
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
});

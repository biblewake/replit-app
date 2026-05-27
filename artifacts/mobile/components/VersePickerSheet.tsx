import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { BibleVerse, BIBLE_VERSES, VERSE_CATEGORIES } from "@/constants/verses";
import BottomSheet from "@/components/BottomSheet";
import { Ionicons } from "@expo/vector-icons";

interface VersePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (verse: BibleVerse) => void;
  selectedRef?: string;
}

export default function VersePickerSheet({
  visible,
  onClose,
  onSelect,
  selectedRef,
}: VersePickerSheetProps) {
  const colors = useColors();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = BIBLE_VERSES.filter((v) => {
    const matchesSearch =
      !search ||
      v.ref.toLowerCase().includes(search.toLowerCase()) ||
      v.text.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !activeCategory || v.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <BottomSheet visible={visible} onClose={onClose} height={680}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Choose a Verse
        </Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={24} color={colors.mutedForeground} />
        </Pressable>
      </View>
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
                onSelect(item);
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

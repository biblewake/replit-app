import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import BottomSheet from "@/components/BottomSheet";

interface AlarmSoundSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function AlarmSoundSheet({ visible, onClose }: AlarmSoundSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet visible={visible} onClose={onClose} height={360}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Alarm Sound</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Custom alarm sounds coming soon.
          </Text>
        </View>

        <View style={[styles.emptyState, { backgroundColor: colors.secondary }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.border }]}>
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
          style={[styles.doneBtn, { marginBottom: Math.max(insets.bottom, 16) + 4 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onClose();
          }}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyState: {
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: "center",
    gap: 10,
    marginBottom: 24,
  },
  iconCircle: {
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
  doneBtn: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});

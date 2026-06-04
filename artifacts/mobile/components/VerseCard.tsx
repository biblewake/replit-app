import React, { useRef } from "react";
import {
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LinearGradient as LinearGradientType } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

const GRADIENTS: [string, string][] = [
  ["#1a1a2e", "#16213e"],
  ["#0f3460", "#533483"],
  ["#2c3e50", "#4ca1af"],
  ["#1a3a2a", "#2d6a4f"],
  ["#3d1a3a", "#6b2d6b"],
  ["#2c1810", "#8b4513"],
];

function getGradientForDate(): [string, string] {
  const idx = new Date().getDate() % GRADIENTS.length;
  return GRADIENTS[idx];
}

interface VerseCardProps {
  reference: string;
  text: string;
  version?: string;
  showShare?: boolean;
  onContinue?: () => void;
  isFinalStep?: boolean;
  flat?: boolean;
}

export default function VerseCard({
  reference,
  text,
  version = "NIV",
  showShare = true,
  onContinue,
  isFinalStep = false,
  flat = false,
}: VerseCardProps) {
  const cardRef = useRef<LinearGradientType>(null);
  const gradient = getGradientForDate();

  const handleShare = async () => {
    if (Platform.OS === "web") {
      await Share.share({ message: `"${text}" — ${reference} (${version})` });
      return;
    }
    try {
      const uri = await captureRef(cardRef, { format: "jpg", quality: 0.95 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: "image/jpeg" });
      } else {
        await Share.share({ message: `"${text}" — ${reference} (${version})` });
      }
    } catch {
      await Share.share({ message: `"${text}" — ${reference} (${version})` });
    }
  };

  return (
    <View style={[styles.container, flat && styles.containerFlat]}>
      <View style={[styles.cardWrapper, flat && styles.cardWrapperFlat]}>
        {/* Captured area: gradient + verse content only, no border radius, no UI chrome */}
        <LinearGradient colors={gradient} style={styles.gradient} ref={cardRef}>
          <View style={styles.verseContent}>
            <Text style={styles.reference}>✦ {reference} ✦</Text>
            <Text style={styles.verseText}>{text}</Text>
          </View>
          <Text style={styles.appTag}>Bible Wake</Text>
        </LinearGradient>

        {/* UI chrome overlaid on top — not captured */}
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>{version}</Text>
          </View>
          {showShare && (
            <Pressable style={styles.shareBtn} onPress={handleShare} hitSlop={8}>
              <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>
          )}
        </View>
      </View>

      {isFinalStep && onContinue && (
        <Pressable style={styles.continueBtn} onPress={onContinue}>
          <Text style={styles.continueBtnText}>Done</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: "#F2F2F7",
  },
  containerFlat: {
    paddingHorizontal: 0,
    backgroundColor: "transparent",
  },
  cardWrapper: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
  },
  cardWrapperFlat: {},
  gradient: {
    width: "100%",
    padding: 28,
    paddingTop: 60,
    gap: 28,
    minHeight: 320,
    justifyContent: "space-between",
  },
  overlay: {
    position: "absolute",
    top: 20,
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  versionBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  versionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
  },
  shareBtn: {
    padding: 4,
  },
  verseContent: {
    gap: 16,
    alignItems: "center",
  },
  reference: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    letterSpacing: 0.8,
  },
  verseText: {
    fontSize: 20,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 32,
  },
  appTag: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  continueBtn: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 100,
    width: "100%",
    alignItems: "center",
  },
  continueBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

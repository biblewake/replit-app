import React, { useEffect, useRef } from "react";
import {
  Animated,
  ImageBackground,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
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
  /** Optional background image URL fetched from verse_background_images.
   *  When provided, replaces the daily gradient with a photo background. */
  backgroundImageUrl?: string | null;
}

export default function VerseCard({
  reference,
  text,
  version = "NIV",
  showShare = true,
  onContinue,
  isFinalStep = false,
  flat = false,
  backgroundImageUrl,
}: VerseCardProps) {
  // captureRef wraps the outer View to capture both gradient and image-background variants
  const cardRef = useRef<View>(null);
  const gradient = getGradientForDate();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleShare = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const handleContinue = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onContinue?.();
  };

  const cardInner = (
    <View style={styles.cardInner}>
      <View style={styles.verseContent}>
        <Text style={styles.verseText}>{text}</Text>
        <Text style={styles.reference}>{reference}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, flat && styles.containerFlat]}>
      <StatusBar style="dark" />
      <Animated.View style={[styles.cardWrapper, flat && styles.cardWrapperFlat, { opacity: fadeAnim }]}>
        {/* Outer View holds the ref used by captureRef for screenshot sharing */}
        <View ref={cardRef} collapsable={false}>
          {backgroundImageUrl ? (
            <ImageBackground
              source={{ uri: backgroundImageUrl }}
              style={styles.gradient}
              imageStyle={styles.backgroundImage}
              resizeMode="cover"
            >
              <View style={styles.imageDimOverlay} />
              {cardInner}
            </ImageBackground>
          ) : (
            <LinearGradient colors={gradient} style={styles.gradient}>
              {cardInner}
            </LinearGradient>
          )}
        </View>

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
      </Animated.View>

      {isFinalStep && onContinue && (
        <Pressable style={styles.continueBtn} onPress={handleContinue}>
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
    backgroundColor: "#FFFFFF",
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
  backgroundImage: {
    borderRadius: 24,
  },
  imageDimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  cardInner: {
    gap: 28,
    justifyContent: "space-between",
    flex: 1,
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
    alignItems: "flex-start",
  },
  reference: {
    fontSize: 14,
    fontFamily: Platform.select({ ios: "TimesNewRomanPS-ItalicMT", android: "serif", default: "serif" }),
    fontStyle: Platform.OS === "android" ? "italic" : undefined,
    color: "rgba(255,255,255,0.7)",
    textAlign: "left",
    letterSpacing: 0.4,
  },
  verseText: {
    fontSize: 21,
    fontFamily: Platform.select({ ios: "TimesNewRomanPSMT", android: "serif", default: "serif" }),
    color: "#FFFFFF",
    textAlign: "left",
    lineHeight: 33,
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

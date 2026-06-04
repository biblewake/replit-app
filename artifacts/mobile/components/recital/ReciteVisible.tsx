import React, { useEffect } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ReciteVisibleProps {
  reference: string;
  text: string;
  verseMode?: "memory" | "declare";
  onContinue: () => void;
}

export default function ReciteVisible({
  reference,
  text,
  verseMode = "memory",
  onContinue,
}: ReciteVisibleProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (Platform.OS !== "web" && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const subtitle =
    verseMode === "declare"
      ? "Read the bible verse at your own pace, then tap Start"
      : "Recite the bible verse from memory, then tap Start";

  const handleStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Audio.requestPermissionsAsync();
    onContinue();
  };

  const cameraReady = Platform.OS !== "web" && permission?.granted;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="dark" />

      <Text style={styles.appTitle}>Bible Wake</Text>

      <View style={styles.container}>
        {cameraReady && (
          <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />
        )}
        <View style={[StyleSheet.absoluteFill, styles.overlay]} />

        <View style={styles.content}>
          <Image
            source={require("@/assets/images/3d_bible.png")}
            style={styles.bibleImage}
            resizeMode="contain"
          />
          <Text style={styles.heading}>Bible Verse</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <Text style={styles.reference}>{reference}</Text>
        </View>
      </View>

      <Pressable style={styles.startBtn} onPress={handleStart}>
        <Text style={styles.startBtnText}>Start</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    gap: 16,
  },
  appTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#1C1C1E",
    textAlign: "center",
    letterSpacing: 0.3,
  },
  container: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#0D0D0D",
  },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  bibleImage: {
    width: 100,
    height: 100,
    marginBottom: 8,
  },
  heading: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.78)",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  reference: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  startBtn: {
    backgroundColor: "#FF9000",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
  },
  startBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

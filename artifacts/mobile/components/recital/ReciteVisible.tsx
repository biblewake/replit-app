import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

interface ReciteVisibleProps {
  reference: string;
  text: string;
  onContinue: () => void;
}

export default function ReciteVisible({ reference, text, onContinue }: ReciteVisibleProps) {
  const { state, metering, error, start, stop, reset } = useVoiceRecorder();

  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (state === "recording") {
      ringOpacity.setValue(1);
      ringAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(ringScale, { toValue: 1.5 + metering * 0.6, duration: 180, useNativeDriver: true }),
          Animated.timing(ringScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        ])
      );
      ringAnim.current.start();
    } else {
      ringAnim.current?.stop();
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [state]);

  useEffect(() => {
    if (state === "recording") {
      const target = 1 + metering * 0.9;
      Animated.spring(ringScale, { toValue: target, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    }
  }, [metering, state]);

  const handleMicPress = async () => {
    if (state === "idle" || state === "error") {
      reset();
      await start();
    } else if (state === "recording") {
      const transcript = await stop();
      onContinue();
    }
  };

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  return (
    <View style={styles.container}>
      <Text style={styles.stepLabel}>Step 1 — Read the verse</Text>

      <View style={styles.card}>
        <Text style={styles.reference}>✦ {reference} ✦</Text>
        <Text style={styles.verseText}>{text}</Text>
      </View>

      <Text style={styles.hint}>
        {isRecording
          ? "Listening… tap to stop when done"
          : isTranscribing
          ? "Processing…"
          : error
          ? "Tap to try again"
          : "Read the verse aloud, then tap to continue"}
      </Text>

      {isTranscribing ? (
        <View style={styles.transcribingBox}>
          <ActivityIndicator color="#F5A623" />
          <Text style={styles.transcribingText}>Transcribing…</Text>
        </View>
      ) : (
        <View style={styles.micWrapper}>
          <Animated.View
            style={[
              styles.micRing,
              {
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          />
          <Pressable
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={handleMicPress}
          >
            <Ionicons
              name={isRecording ? "stop" : "mic"}
              size={28}
              color="#FFFFFF"
            />
            <Text style={styles.micBtnText}>
              {isRecording ? "Stop" : "Read verse aloud"}
            </Text>
          </Pressable>
        </View>
      )}

      {error && !isTranscribing && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 24,
  },
  stepLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 24,
    width: "100%",
    gap: 16,
  },
  reference: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F5A623",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  verseText: {
    fontSize: 19,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 29,
  },
  hint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  micWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  micRing: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "rgba(245,166,35,0.5)",
    backgroundColor: "rgba(245,166,35,0.08)",
  },
  micBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5A623",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 100,
  },
  micBtnActive: {
    backgroundColor: "#CC2222",
  },
  micBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  transcribingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  transcribingText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#FF6B6B",
    textAlign: "center",
  },
});

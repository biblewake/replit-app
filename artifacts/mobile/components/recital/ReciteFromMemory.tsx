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

interface ReciteFromMemoryProps {
  reference: string;
  onTranscript: (text: string) => void;
}

export default function ReciteFromMemory({ reference, onTranscript }: ReciteFromMemoryProps) {
  const { state, metering, error, start, stop, reset } = useVoiceRecorder();

  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === "recording") {
      ringOpacity.setValue(1);
    } else {
      Animated.timing(ringOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [state]);

  useEffect(() => {
    if (state === "recording") {
      const target = 1 + metering * 1.1;
      Animated.spring(ringScale, {
        toValue: target,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }).start();
    }
  }, [metering, state]);

  const handlePress = async () => {
    if (state === "idle" || state === "error") {
      reset();
      await start();
    } else if (state === "recording") {
      const transcript = await stop();
      if (transcript !== null) {
        onTranscript(transcript);
      }
    }
  };

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  return (
    <View style={styles.container}>
      <Text style={styles.stepLabel}>Step 2 — Recite from memory</Text>

      <View style={styles.card}>
        <Text style={styles.reference}>✦ {reference} ✦</Text>
        <View style={styles.hiddenRows}>
          {[100, 88, 95, 72].map((w, i) => (
            <View key={i} style={[styles.hiddenLine, { width: `${w}%` }]} />
          ))}
        </View>
        <Text style={styles.hiddenHint}>Verse hidden — recite from memory</Text>
      </View>

      {isRecording && (
        <View style={styles.liveBar}>
          <View style={[styles.liveDot, { backgroundColor: "#CC2222" }]} />
          <Text style={styles.liveText}>Listening…</Text>
          <View style={styles.levelBars}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.levelBar,
                  {
                    height: 4 + (metering > (i / 8) ? 14 * metering : 4),
                    opacity: metering > (i / 8) ? 1 : 0.25,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      {!isRecording && !isTranscribing && (
        <Text style={styles.hint}>
          {error ? "Something went wrong — tap to try again" : "Speak the verse from memory"}
        </Text>
      )}

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
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          <Pressable
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={handlePress}
          >
            <Ionicons
              name={isRecording ? "stop" : "mic"}
              size={28}
              color="#FFFFFF"
            />
            <Text style={styles.micBtnText}>
              {isRecording ? "Done — check my answer" : error ? "Try again" : "Recite verse"}
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
    gap: 22,
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
    gap: 14,
    alignItems: "center",
  },
  reference: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#F5A623",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  hiddenRows: {
    width: "100%",
    gap: 10,
    alignItems: "center",
  },
  hiddenLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  hiddenHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    marginTop: 4,
  },
  liveBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(204,34,34,0.3)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  levelBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 20,
  },
  levelBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: "#F5A623",
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
    borderColor: "rgba(204,34,34,0.5)",
    backgroundColor: "rgba(204,34,34,0.08)",
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

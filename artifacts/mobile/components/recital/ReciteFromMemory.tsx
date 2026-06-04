import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

interface ReciteFromMemoryProps {
  reference: string;
  text?: string;
  verseMode?: "memory" | "declare";
  onTranscript: (text: string) => void;
  onAlarmStop?: () => void;
}

export default function ReciteFromMemory({
  reference,
  text = "",
  verseMode = "memory",
  onTranscript,
  onAlarmStop,
}: ReciteFromMemoryProps) {
  const insets = useSafeAreaInsets();
  const [permission] = useCameraPermissions();
  const { state, error, start, stop } = useVoiceRecorder();
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef<Animated.CompositeAnimation | null>(null);
  const startedRef = useRef(false);
  const alarmStoppedRef = useRef(false);
  const [startFailed, setStartFailed] = useState(false);

  const tryStart = async (): Promise<boolean> => {
    setStartFailed(false);
    try {
      await start();
      return true;
    } catch {
      setStartFailed(true);
      return false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (startedRef.current) return;
      startedRef.current = true;
      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      const ok = await tryStart();
      if (!ok && !cancelled) {
        await new Promise((r) => setTimeout(r, 800));
        if (!cancelled) await tryStart();
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (state === "error") {
      setStartFailed(true);
    }
    if (state === "recording") {
      setStartFailed(false);
      if (!alarmStoppedRef.current) {
        alarmStoppedRef.current = true;
        onAlarmStop?.();
      }
      dotAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      dotAnim.current.start();
    } else {
      dotAnim.current?.stop();
      dotOpacity.setValue(1);
    }
  }, [state]);

  const handleDone = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const transcript = await stop();
    onTranscript(transcript ?? "");
  };

  const handleManualStart = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startedRef.current = true;
    await tryStart();
  };

  const cameraReady = Platform.OS !== "web" && permission?.granted;
  const isRecording = state === "recording";

  const retryMessage =
    verseMode === "declare"
      ? "Read the verse clearly and slowly — match the words shown"
      : "Speak from memory word for word — try again";

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
          <Text style={styles.reference}>{reference}</Text>
          <View style={styles.divider} />

          {verseMode === "declare" ? (
            <Text style={styles.verseText}>{text}</Text>
          ) : (
            <View style={styles.skeleton}>
              {[100, 88, 95, 72, 60].map((w, i) => (
                <View key={i} style={[styles.skeletonLine, { width: `${w}%` }]} />
              ))}
            </View>
          )}

          <View style={styles.recordingRow}>
            {isRecording ? (
              <>
                <Animated.View style={[styles.redDot, { opacity: dotOpacity }]} />
                <Text style={styles.recordingLabel}>Recording — alarm paused</Text>
              </>
            ) : state === "transcribing" ? (
              <Text style={styles.waitingLabel}>Processing…</Text>
            ) : startFailed || state === "error" ? (
              <Text style={styles.retryHint}>{retryMessage}</Text>
            ) : (
              <Text style={styles.waitingLabel}>Starting mic…</Text>
            )}
          </View>
        </View>
      </View>

      {state === "transcribing" ? (
        <Pressable style={[styles.doneBtn, styles.doneBtnDisabled]}>
          <Text style={styles.doneBtnText}>Processing…</Text>
        </Pressable>
      ) : startFailed || state === "error" ? (
        <Pressable style={styles.startRecordBtn} onPress={handleManualStart}>
          <Text style={styles.startRecordBtnText}>Tap to Start Recording</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.doneBtn, !isRecording && styles.doneBtnDisabled]}
          onPress={isRecording ? handleDone : undefined}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      )}
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
    padding: 28,
    gap: 18,
    justifyContent: "space-between",
  },
  reference: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginHorizontal: 8,
  },
  verseText: {
    flex: 1,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 28,
    textAlignVertical: "center",
  },
  skeleton: {
    flex: 1,
    gap: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 4,
    minHeight: 24,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF3B30",
  },
  recordingLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
  },
  waitingLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  retryHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,100,100,0.9)",
    textAlign: "center",
  },
  doneBtn: {
    backgroundColor: "#FF9000",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
  },
  doneBtnDisabled: {
    opacity: 0.45,
  },
  doneBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  startRecordBtn: {
    backgroundColor: "#1C1C1E",
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: "center",
  },
  startRecordBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});

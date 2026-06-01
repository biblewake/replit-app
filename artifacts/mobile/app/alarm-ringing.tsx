import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

import { useAlarms } from "@/context/AlarmContext";
import { getSoundById } from "@/constants/alarmSounds";
import RecitalFlow from "@/components/recital/RecitalFlow";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDE_THRESHOLD = SCREEN_WIDTH * 0.55;
const TRACK_WIDTH = SCREEN_WIDTH - 64;
const THUMB_SIZE = 56;

function useCurrentTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatClock(date: Date) {
  let h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { time: `${h}:${m}`, ampm };
}

export default function AlarmRingingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ alarmId: string; type: "verse" | "wakeup" }>();
  const { alarms } = useAlarms();
  const now = useCurrentTime();
  const { time, ampm } = formatClock(now);

  const alarm = alarms.find((a) => a.id === params.alarmId) ?? alarms[0] ?? null;
  const alarmType: "verse" | "wakeup" = params.type ?? (alarm?.wakeUpCheck ? "wakeup" : "verse");

  const [phase, setPhase] = useState<"ringing" | "recital">("ringing");
  const soundRef = useRef<Audio.Sound | null>(null);

  const thumbX = useRef(new Animated.Value(0)).current;
  const trackOpacity = useRef(new Animated.Value(1)).current;
  const [slid, setSlid] = useState(false);

  useEffect(() => {
    let mounted = true;
    const playAlarm = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const soundId = alarm?.soundId;
        const soundMeta = soundId ? getSoundById(soundId) : null;
        const source = soundMeta
          ? soundMeta.source
          : require("@/assets/sounds/bright/chirps.mp3");
        const { sound } = await Audio.Sound.createAsync(source, {
          isLooping: true,
          volume: 1.0,
        });
        if (!mounted) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        await sound.playAsync();
      } catch (_) {}
    };
    playAlarm();
    return () => {
      mounted = false;
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
  }, []);

  const stopAlarm = async () => {
    try {
      await soundRef.current?.stopAsync();
      await soundRef.current?.unloadAsync();
      soundRef.current = null;
    } catch (_) {}
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !slid,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 5,
      onPanResponderMove: (_, gs) => {
        const x = Math.max(0, Math.min(gs.dx, TRACK_WIDTH - THUMB_SIZE));
        thumbX.setValue(x);
      },
      onPanResponderRelease: async (_, gs) => {
        if (gs.dx >= SLIDE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.parallel([
            Animated.timing(thumbX, {
              toValue: TRACK_WIDTH - THUMB_SIZE,
              duration: 120,
              useNativeDriver: true,
            }),
            Animated.timing(trackOpacity, {
              toValue: 0,
              duration: 220,
              useNativeDriver: true,
            }),
          ]).start(async () => {
            await stopAlarm();
            setSlid(true);
            setPhase("recital");
          });
        } else {
          Animated.spring(thumbX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const handleDismiss = () => {
    router.back();
  };

  const handleReturnToRinging = async () => {
    setPhase("ringing");
    setSlid(false);
    thumbX.setValue(0);
    trackOpacity.setValue(1);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const soundId = alarm?.soundId;
      const soundMeta = soundId ? getSoundById(soundId) : null;
      const source = soundMeta
        ? soundMeta.source
        : require("@/assets/sounds/bright/chirps.mp3");
      const { sound } = await Audio.Sound.createAsync(source, {
        isLooping: true,
        volume: 1.0,
      });
      soundRef.current = sound;
      await sound.playAsync();
    } catch (_) {}
  };

  if (phase === "recital") {
    return (
      <RecitalFlow
        alarmId={alarm?.id ?? ""}
        type={alarmType}
        verseReference={alarm?.verseRef ?? ""}
        verseText={alarm?.verseText ?? ""}
        verseVersion="NIV"
        onDismiss={handleDismiss}
        onReturnToRinging={handleReturnToRinging}
      />
    );
  }

  return (
    <View style={styles.container}>
      {Platform.OS !== "web" && <StatusBar hidden />}
      <View style={[styles.topContent, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.label}>
          {alarmType === "verse" ? "Recite Verse" : "Wake-up Check"}
        </Text>
        <Text style={styles.clockTime}>{time}</Text>
        <Text style={styles.ampm}>{ampm}</Text>
        <Text style={styles.subtitle}>Bible Wake</Text>
      </View>

      <Animated.View style={[styles.slideTrack, { opacity: trackOpacity }]}>
        <Text style={styles.slideHint}>slide to stop</Text>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            { transform: [{ translateX: thumbX }] },
          ]}
        >
          <Text style={styles.thumbArrow}>›</Text>
        </Animated.View>
      </Animated.View>
      <View style={{ height: insets.bottom + 32 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topContent: {
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  clockTime: {
    fontSize: 88,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: -4,
    lineHeight: 96,
  },
  ampm: {
    fontSize: 22,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: -8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.35)",
    marginTop: 16,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  slideTrack: {
    width: SCREEN_WIDTH - 64,
    height: 64,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingLeft: 4,
    marginBottom: 16,
    overflow: "hidden",
  },
  slideHint: {
    position: "absolute",
    width: "100%",
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 1,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  thumbArrow: {
    fontSize: 28,
    color: "#1C1C1E",
    marginTop: -2,
    marginLeft: 2,
  },
});

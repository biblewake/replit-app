import { useState, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: ".m4a",
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: ".m4a",
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
  isMeteringEnabled: true,
};

export type VoiceRecorderState = "idle" | "recording" | "transcribing" | "error";

export interface UseVoiceRecorderReturn {
  state: VoiceRecorderState;
  metering: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  reset: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [metering, setMetering] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearMeteringTimer = () => {
    if (meteringTimer.current) {
      clearInterval(meteringTimer.current);
      meteringTimer.current = null;
    }
  };

  const reset = useCallback(() => {
    clearMeteringTimer();
    setMetering(0);
    setError(null);
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      setState("idle");

      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setError("Microphone permission denied");
        setState("error");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;
      setState("recording");

      meteringTimer.current = setInterval(async () => {
        try {
          const status = await recording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            const level = Math.max(0, Math.min(1, (status.metering + 60) / 60));
            setMetering(level);
          }
        } catch (_) {}
      }, 80);
    } catch (_) {
      clearMeteringTimer();
      setError("Could not access microphone");
      setState("error");
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    clearMeteringTimer();
    setMetering(0);

    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return null;

    try {
      await recording.stopAndUnloadAsync();
    } catch (_) {}

    const uri = recording.getURI();
    if (!uri) {
      setError("No audio captured");
      setState("error");
      return null;
    }

    setState("transcribing");

    try {
      const formData = new FormData();

      if (Platform.OS === "web") {
        const blobRes = await fetch(uri);
        const blob = await blobRes.blob();
        formData.append("audio", blob, "recording.webm");
      } else {
        formData.append("audio", {
          uri,
          type: "audio/m4a",
          name: "recording.m4a",
        } as unknown as Blob);
      }

      const res = await fetch(`${API_BASE}/deepgram/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { transcript: string };
      setState("idle");
      return data.transcript ?? "";
    } catch (_) {
      setError("Transcription failed — please try again");
      setState("error");
      return null;
    }
  }, []);

  return { state, metering, error, start, stop, reset };
}

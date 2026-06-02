import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import ReciteVisible from "./ReciteVisible";
import ReciteFromMemory from "./ReciteFromMemory";
import AnalyzingVerse from "./AnalyzingVerse";
import TryAgain from "./TryAgain";
import AlarmSuccess from "./AlarmSuccess";
import StreakCelebration from "./StreakCelebration";
import WakeUpPhraseTyping from "./WakeUpPhraseTyping";
import VerseCard from "@/components/VerseCard";
import { useAlarms } from "@/context/AlarmContext";
import { supabase } from "@/lib/supabase";
import { recordWakeEvent } from "@/lib/wakeHistory";

type Step =
  | "reciteVisible"
  | "reciteMemory"
  | "analyzing"
  | "tryAgain"
  | "success"
  | "streak"
  | "verseOfDay"
  | "wakeUpPhrase";

interface RecitalFlowProps {
  alarmId: string;
  type: "verse" | "wakeup";
  verseReference?: string;
  verseText?: string;
  verseVersion?: string;
  verseMode?: "memory" | "declare";
  verseBackgroundImageId?: string | null;
  onDismiss: () => void;
  onReturnToRinging: () => void;
}

export default function RecitalFlow({
  alarmId,
  type,
  verseReference = "",
  verseText = "",
  verseVersion = "NIV",
  verseMode,
  verseBackgroundImageId,
  onDismiss,
  onReturnToRinging,
}: RecitalFlowProps) {
  const { streak, incrementStreak, alarms } = useAlarms();
  const [step, setStep] = useState<Step>(
    type === "wakeup" ? "wakeUpPhrase" : "reciteVisible"
  );
  const [spokenText, setSpokenText] = useState("");
  const [streakJustIncremented, setStreakJustIncremented] = useState(false);

  // Track recital timing
  const recitalStartRef = useRef<number | null>(null);
  const recitalResultRef = useRef<{
    transcript: string;
    accuracy: number;
    durationSeconds: number;
    success: boolean;
  } | null>(null);

  // Wake-up phrase attempt counter
  const wakeUpAttemptsRef = useRef(0);

  const alarm = alarms.find((a) => a.id === alarmId);

  /** Persist the wake event to Supabase (non-blocking, best-effort) */
  const persistWakeEvent = async (opts: {
    recitalSuccess?: boolean;
    wakeUpCheckCompleted?: boolean;
  }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await recordWakeEvent({
      userId: session.user.id,
      alarmId: alarmId || null,
      alarmName: alarm?.name ?? null,
      verseRef: verseReference || null,
      verseText: verseText || null,
      verseMode: verseMode ?? alarm?.verseMode ?? null,
      wakeUpCheckRequired: type === "wakeup",
      wakeUpCheckCompleted: opts.wakeUpCheckCompleted ?? false,
      wakeUpPhraseAttempts: wakeUpAttemptsRef.current,
      recitalTranscript: recitalResultRef.current?.transcript ?? null,
      recitalAccuracy: recitalResultRef.current?.accuracy ?? null,
      recitalDurationSeconds: recitalResultRef.current?.durationSeconds ?? null,
      recitalSuccess: recitalResultRef.current?.success ?? opts.recitalSuccess ?? null,
      verseBackgroundImageId:
        alarm?.verseBackgroundImageId ?? verseBackgroundImageId ?? null,
    });
  };

  const handleTranscript = (text: string) => {
    setSpokenText(text);
    recitalStartRef.current = recitalStartRef.current ?? Date.now();
    setStep("analyzing");
  };

  const handleAnalysisResult = (passed: boolean, accuracy?: number) => {
    if (recitalStartRef.current != null) {
      const durationSeconds = Math.round(
        (Date.now() - recitalStartRef.current) / 1000
      );
      recitalResultRef.current = {
        transcript: spokenText,
        accuracy: accuracy ?? (passed ? 1.0 : 0.0),
        durationSeconds,
        success: passed,
      };
    }

    if (passed) {
      setStep("success");
    } else {
      setStep("tryAgain");
    }
  };

  const handleSuccessContinue = () => {
    if (type === "wakeup") {
      persistWakeEvent({ wakeUpCheckCompleted: true });
      onDismiss();
      return;
    }

    persistWakeEvent({ recitalSuccess: recitalResultRef.current?.success ?? true });
    incrementStreak();
    setStreakJustIncremented(true);
    setStep("streak");
  };

  const handleStreakContinue = () => {
    setStep("verseOfDay");
  };

  const handleWakeUpSuccess = () => {
    wakeUpAttemptsRef.current += 1;
    setStep("success");
  };

  const renderStep = () => {
    switch (step) {
      case "reciteVisible":
        return (
          <ReciteVisible
            reference={verseReference}
            text={verseText}
            onContinue={() => {
              recitalStartRef.current = Date.now();
              setStep("reciteMemory");
            }}
          />
        );
      case "reciteMemory":
        return (
          <ReciteFromMemory
            reference={verseReference}
            onTranscript={handleTranscript}
          />
        );
      case "analyzing":
        return (
          <AnalyzingVerse
            spoken={spokenText}
            target={verseText}
            onResult={handleAnalysisResult}
          />
        );
      case "tryAgain":
        return (
          <TryAgain
            onTryAgain={() => {
              recitalStartRef.current = Date.now();
              setStep("reciteVisible");
            }}
          />
        );
      case "success":
        return <AlarmSuccess onContinue={handleSuccessContinue} />;
      case "streak":
        return (
          <StreakCelebration
            streak={streak + (streakJustIncremented ? 0 : 1)}
            onContinue={handleStreakContinue}
          />
        );
      case "verseOfDay":
        return (
          <VerseCard
            reference={verseReference}
            text={verseText}
            version={verseVersion}
            showShare
            isFinalStep
            onContinue={onDismiss}
          />
        );
      case "wakeUpPhrase":
        return (
          <WakeUpPhraseTyping
            onSuccess={handleWakeUpSuccess}
            onClose={onReturnToRinging}
          />
        );
      default:
        return null;
    }
  };

  const isDark =
    step === "reciteVisible" ||
    step === "reciteMemory" ||
    step === "wakeUpPhrase";
  const isStreakDark = step === "streak";

  return (
    <View
      style={[
        styles.container,
        isDark && styles.darkBg,
        isStreakDark && styles.streakBg,
      ]}
    >
      {renderStep()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  darkBg: {
    backgroundColor: "#0D0D0D",
  },
  streakBg: {
    backgroundColor: "#1C1C1E",
  },
});

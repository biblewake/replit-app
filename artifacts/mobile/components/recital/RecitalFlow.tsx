import React, { useState } from "react";
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
  onDismiss: () => void;
  onReturnToRinging: () => void;
}

export default function RecitalFlow({
  alarmId,
  type,
  verseReference = "",
  verseText = "",
  verseVersion = "NIV",
  onDismiss,
  onReturnToRinging,
}: RecitalFlowProps) {
  const { streak, incrementStreak } = useAlarms();
  const [step, setStep] = useState<Step>(type === "wakeup" ? "wakeUpPhrase" : "reciteVisible");
  const [spokenText, setSpokenText] = useState("");
  const [streakJustIncremented, setStreakJustIncremented] = useState(false);

  const handleTranscript = (text: string) => {
    setSpokenText(text);
    setStep("analyzing");
  };

  const handleAnalysisResult = (passed: boolean) => {
    if (passed) {
      setStep("success");
    } else {
      setStep("tryAgain");
    }
  };

  const handleSuccessContinue = () => {
    if (type === "wakeup") {
      onDismiss();
      return;
    }
    incrementStreak();
    setStreakJustIncremented(true);
    setStep("streak");
  };

  const handleStreakContinue = () => {
    setStep("verseOfDay");
  };

  const renderStep = () => {
    switch (step) {
      case "reciteVisible":
        return (
          <ReciteVisible
            reference={verseReference}
            text={verseText}
            onContinue={() => setStep("reciteMemory")}
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
        return <TryAgain onTryAgain={() => setStep("reciteVisible")} />;
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
            onSuccess={() => setStep("success")}
            onClose={onReturnToRinging}
          />
        );
      default:
        return null;
    }
  };

  const isDark = step === "reciteVisible" || step === "reciteMemory" || step === "wakeUpPhrase";
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

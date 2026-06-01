import React, { useState, useRef, useEffect } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const WAKE_UP_PHRASES = [
  "I am awake and ready",
  "Rise and shine today",
  "Good morning world",
  "Today is a new day",
  "I choose to wake up",
];

function getPhraseForToday(): string {
  const idx = new Date().getDate() % WAKE_UP_PHRASES.length;
  return WAKE_UP_PHRASES[idx];
}

interface WakeUpPhraseTypingProps {
  onSuccess: () => void;
  onClose: () => void;
}

export default function WakeUpPhraseTyping({ onSuccess, onClose }: WakeUpPhraseTypingProps) {
  const insets = useSafeAreaInsets();
  const [typed, setTyped] = useState("");
  const inputRef = useRef<TextInput>(null);
  const phrase = getPhraseForToday();
  const phraseWords = phrase.split(" ");

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  const typedWords = typed.split(" ");

  const handleChange = (text: string) => {
    setTyped(text);
    if (text.toLowerCase().trim() === phrase.toLowerCase()) {
      Keyboard.dismiss();
      setTimeout(onSuccess, 300);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Enter the following wake-up phrase</Text>
        <View style={styles.phraseRow}>
          {phraseWords.map((word, i) => {
            const typedWord = typedWords[i] ?? "";
            const isComplete = i < typedWords.length - 1;
            const isMatching =
              isComplete
                ? typedWord.toLowerCase() === word.toLowerCase()
                : word.toLowerCase().startsWith(typedWord.toLowerCase()) && typedWord.length > 0;
            return (
              <React.Fragment key={i}>
                <Text
                  style={[
                    styles.phraseWord,
                    isComplete && isMatching && styles.phraseWordMatch,
                    isComplete && !isMatching && styles.phraseWordMismatch,
                  ]}
                >
                  {word}
                </Text>
                {i < phraseWords.length - 1 && <Text style={styles.phraseSpace}> </Text>}
              </React.Fragment>
            );
          })}
        </View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={typed}
          onChangeText={handleChange}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="done"
        />
        <Pressable style={styles.typeArea} onPress={() => inputRef.current?.focus()}>
          <Text style={styles.typeAreaHint}>
            {typed.length === 0 ? "Tap here and start typing…" : typed}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    alignItems: "flex-end",
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    gap: 32,
  },
  label: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 24,
  },
  phraseRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 2,
  },
  phraseWord: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.3)",
  },
  phraseWordMatch: {
    color: "#F5A623",
  },
  phraseWordMismatch: {
    color: "#FF3B30",
  },
  phraseSpace: {
    fontSize: 28,
    color: "transparent",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  typeArea: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 60,
  },
  typeAreaHint: {
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
});

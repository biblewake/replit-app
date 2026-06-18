import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAuth } from "@/context/AuthContext";
import { useAlarms } from "@/context/AlarmContext";
import { supabase } from "@/lib/supabase";
import { BibleVerse } from "@/constants/verses";
import {
  BackArrow,
  ContinueButton,
  FadeIn,
  InsightScreen,
  OL,
  ONBOARDING_ORANGE,
  ProgressBar,
  SelectionCard,
  StepQuestion,
} from "@/components/onboarding/primitives";
import {
  AnimatedLineChart,
  ComparisonCards,
  CountUpStat,
  Typewriter,
} from "@/components/onboarding/charts";
import { PhoneDemoVideo } from "@/components/onboarding/PhoneDemoVideo";
import {
  DaysGrid,
  SoundPickerInline,
  TimePicker,
  VersePickerInline,
  WakeTime,
} from "@/components/onboarding/alarmSetup";
import { PermissionScreen } from "@/components/onboarding/permissionSteps";
import { SignatureCanvas } from "@/components/onboarding/SignatureCanvas";
import {
  AccountScreen,
  AnalysisScreen,
  Paywall,
} from "@/components/onboarding/finalSteps";
import {
  FAITH_FLAT,
  FAITH_RISING,
  getQuestion,
  SNOOZE_FALLING,
  SNOOZE_RISING,
} from "@/components/onboarding/content";
import { ONBOARDING_ANSWERS_KEY } from "@/services/onboardingSync";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

// Step 24 removed (App Store review). Total steps = 30.
const TOTAL_STEPS = 30;

interface AlarmDraft {
  wakeTime: WakeTime;
  days: boolean[];
  verse?: BibleVerse;
  verseMode: "memory" | "declare";
  soundId?: string;
}

const DEFAULT_DRAFT: AlarmDraft = {
  wakeTime: { hour: 6, minute: 30, isPM: false },
  days: [false, true, true, true, true, true, false],
  verseMode: "memory",
};

function formatWakeTime(t: WakeTime): string {
  return `${t.hour}:${String(t.minute).padStart(2, "0")} ${t.isPM ? "PM" : "AM"}`;
}

/* ── Welcome screen with left-aligned typewriter title ───────────────────── */
function WelcomeScreen() {
  const TITLE = "Welcome to Bible Wake";
  const [titleCount, setTitleCount] = useState(0);
  const [showSub, setShowSub] = useState(false);
  const subFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let idx = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      idx += 1;
      setTitleCount(idx);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      if (idx >= TITLE.length) {
        setTimeout(() => {
          setShowSub(true);
          Animated.timing(subFade, {
            toValue: 1,
            duration: 500,
            useNativeDriver: USE_NATIVE_DRIVER,
          }).start();
        }, 250);
        return;
      }
      timer = setTimeout(tick, 46);
    };
    timer = setTimeout(tick, 300);
    return () => clearTimeout(timer);
  }, [subFade]);

  return (
    <View style={styles.welcomeWrap}>
      <Text style={styles.welcomeTitle}>{TITLE.slice(0, titleCount)}</Text>
      {showSub ? (
        <Animated.Text style={[styles.welcomeSub, { opacity: subFade }]}>
          Let&apos;s learn about your mornings and build a scripture habit that
          actually sticks.
        </Animated.Text>
      ) : null}
    </View>
  );
}

/* ── Main navigator ──────────────────────────────────────────────────────── */
export default function OnboardingNavigator() {
  const router = useRouter();
  const { completeOnboarding, session } = useAuth();
  const { addAlarm } = useAlarms();

  // DEV: set to 0 for full onboarding, 30 to jump straight to the paywall
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<AlarmDraft>(DEFAULT_DRAFT);
  const [hasSignature, setHasSignature] = useState(false);
  const [countUpDone, setCountUpDone] = useState(false);

  // Fade transition on step change
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [step, fade]);

  // Reset count-up gate when leaving step 13
  useEffect(() => {
    if (step !== 13) setCountUpDone(false);
  }, [step]);

  // ATT request on first question
  useEffect(() => {
    if (step === 1 && Platform.OS !== "web") {
      import("expo-tracking-transparency")
        .then((m) => m.requestTrackingPermissionsAsync())
        .catch(() => {});
    }
  }, [step]);

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, []);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const setAnswer = useCallback((key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Toggle a value in a comma-separated multi-select answer
  const toggleMulti = useCallback((key: string, opt: string) => {
    setAnswers((prev) => {
      const current = prev[key] ? prev[key].split(",").filter(Boolean) : [];
      const next = current.includes(opt)
        ? current.filter((o) => o !== opt)
        : [...current, opt];
      return { ...prev, [key]: next.join(",") };
    });
  }, []);

  const persistAnswers = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_ANSWERS_KEY, JSON.stringify(answers));
    } catch {
      // non-fatal
    }
  }, [answers]);

  const syncNow = useCallback(async (userId: string) => {
    const { syncOnboardingAnswers } = await import("@/services/onboardingSync");
    void syncOnboardingAnswers(supabase, userId);
  }, []);

  const finish = useCallback(async () => {
    const { wakeTime, days, verse, verseMode, soundId } = draft;
    try {
      addAlarm({
        hour: wakeTime.hour,
        minute: wakeTime.minute,
        isPM: wakeTime.isPM,
        days,
        name: "Morning Alarm",
        verseRef: verse?.ref ?? "",
        verseText: verse?.text ?? "",
        enabled: true,
        alarmType: verse ? "verse" : "normal",
        scheduleType: "scheduled",
        wakeUpCheck: false,
        soundId,
        verseMode: verse ? verseMode : undefined,
      });
    } catch {
      // alarm creation failure should not block finishing onboarding
    }
    await completeOnboarding();
    router.replace("/(tabs)");
  }, [draft, addAlarm, completeOnboarding, router]);

  // ── Progress + continue-enabled ──────────────────────────────────────────
  const progress = step / TOTAL_STEPS;

  const question = getQuestion(step);
  const continueEnabled = useMemo(() => {
    if (question) {
      if (question.key === "verse_memory") return Boolean(answers["verse_memory"]);
      return Boolean(answers[question.key]);
    }
    if (step === 13) return countUpDone;
    if (step === 20) return draft.days.some(Boolean);
    if (step === 21) return Boolean(draft.verse);
    if (step === 22) return Boolean(draft.soundId);
    if (step === 27) return hasSignature;
    return true;
  }, [question, answers, step, draft, hasSignature, countUpDone]);

  // ── Step renderer ────────────────────────────────────────────────────────
  const renderStep = () => {
    // Welcome
    if (step === 0) {
      return <WelcomeScreen />;
    }

    // Question steps (1-3, 5-7, 9-12, 14-15)
    if (question) {
      const isMulti = question.key === "verse_memory";
      return (
        <View style={{ flex: 1 }}>
          <StepQuestion title={question.title} subtitle={question.subtitle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.optionsContainer}
          >
            {question.options.map((opt, i) => {
              const selected = isMulti
                ? (answers[question.key] || "").split(",").filter(Boolean).includes(opt)
                : answers[question.key] === opt;
              return (
                <SelectionCard
                  key={opt}
                  label={opt}
                  index={question.numbered ? i + 1 : undefined}
                  selected={selected}
                  onPress={() => {
                    if (isMulti) toggleMulti(question.key, opt);
                    else setAnswer(question.key, opt);
                  }}
                />
              );
            })}
          </ScrollView>
        </View>
      );
    }

    switch (step) {
      // Insight — snooze chart
      case 4:
        return (
          <InsightScreen
            title="Bible Wake prevents you from snoozing"
            statLabel="84% of users report becoming a morning person after just 2 weeks."
          >
            <AnimatedLineChart
              falling={SNOOZE_FALLING}
              rising={SNOOZE_RISING}
              fallingLabel="With Bible Wake"
              risingLabel="Traditional alarm"
            />
          </InsightScreen>
        );

      // Insight — set only one alarm
      case 8:
        return (
          <InsightScreen
            title="Set only one alarm"
            body="Stop setting backup alarms. Bible Wake guarantees you wake up by demanding you recite scripture."
          >
            <ComparisonCards />
          </InsightScreen>
        );

      // Dynamic stat — memorization (disabled until animation done)
      case 13:
        return (
          <InsightScreen title="Most Christians know verses exist. Few can actually say them.">
            <CountUpStat
              values={[
                { value: 89, label: "believe they should memorize scripture" },
                { value: 25, label: "actually do it weekly" },
              ]}
              onDone={() => setCountUpDone(true)}
            />
          </InsightScreen>
        );

      // Insight — start every day with scripture (bible image)
      case 16:
        return (
          <InsightScreen
            title="Start every day with scripture"
            body="The first thing you reach for sets the tone for your whole day. Make it the Word, not your notifications."
          >
            <View style={{ paddingVertical: 24 }}>
              <Image
                source={require("../../assets/images/new-bible.png")}
                style={{ width: 180, height: 180 }}
                resizeMode="contain"
              />
            </View>
          </InsightScreen>
        );

      // Insight — faith journey chart
      case 17:
        return (
          <InsightScreen
            title="Memorizing verses helps your faith grow"
            statLabel="Daily scripture engagement is the #1 predictor of lasting spiritual growth."
          >
            <AnimatedLineChart
              falling={FAITH_RISING}
              rising={FAITH_FLAT}
              fallingLabel="Your Bible journey"
              risingLabel="I'll read later…"
              showCrossMarkers
            />
          </InsightScreen>
        );

      // Typewriter — colored, with pause
      case 18:
        return (
          <View style={styles.typewriterBody}>
            <Typewriter />
          </View>
        );

      // Alarm — time
      case 19:
        return (
          <View style={styles.centeredBody}>
            <StepQuestion
              title="What time do you want to wake up?"
              subtitle="You can always change this later."
            />
            <View style={styles.centerFlex}>
              <TimePicker
                value={draft.wakeTime}
                onChange={(wakeTime) => setDraft((d) => ({ ...d, wakeTime }))}
              />
            </View>
          </View>
        );

      // Alarm — days
      case 20:
        return (
          <View style={styles.centeredBody}>
            <StepQuestion
              title="Which days?"
              subtitle="Pick the mornings you want to wake in the Word."
            />
            <View style={styles.centerFlex}>
              <DaysGrid
                days={draft.days}
                onChange={(days) => setDraft((d) => ({ ...d, days }))}
              />
            </View>
          </View>
        );

      // Alarm — verse (multi-stage picker)
      case 21:
        return (
          <View style={styles.flexBody}>
            <StepQuestion title="Choose your verse" />
            <VersePickerInline
              selectedRef={draft.verse?.ref}
              onSelect={(verse, mode) =>
                setDraft((d) => ({ ...d, verse, verseMode: mode }))
              }
            />
          </View>
        );

      // Alarm — sound
      case 22:
        return (
          <View style={styles.flexBody}>
            <StepQuestion title="Pick your alarm sound" />
            <View style={styles.optionsContainer}>
              <SoundPickerInline
                selectedId={draft.soundId}
                onSelect={(soundId) => setDraft((d) => ({ ...d, soundId }))}
              />
            </View>
          </View>
        );

      // App demo (phone video) — rendered outside renderStep() for video preload
      case 23:
        return null;

      // Permissions (no "Join thousands" step — removed)
      case 24:
        return <PermissionScreen kind="notifications" onContinue={goNext} />;
      case 25:
        return <PermissionScreen kind="alarm" onContinue={goNext} />;
      case 26:
        return <PermissionScreen kind="camera" onContinue={goNext} />;

      // Signature commitment (was 28, now 27)
      case 27:
        return (
          <View style={styles.centeredBody}>
            <StepQuestion title="Sign your commitment" />
            <Text style={[styles.commitText, { color: OL.mutedForeground }]}>
              Promise yourself that you will wake up tomorrow at{" "}
              <Text style={{ color: ONBOARDING_ORANGE, fontFamily: "Inter_700Bold" }}>
                {formatWakeTime(draft.wakeTime)}
              </Text>
              , when your alarm goes off.
            </Text>
            <View style={styles.centerFlex}>
              <SignatureCanvas onStrokeChange={setHasSignature} />
            </View>
            <Text style={[styles.dateStamp, { color: OL.mutedForeground }]}>
              {new Date().toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          </View>
        );

      // Analysis — auto-advances (was 29, now 28)
      case 28:
        return (
          <View style={styles.flexBody}>
            <AnalysisScreen
              onDone={() => {
                void persistAnswers();
                goNext();
              }}
            />
          </View>
        );

      // Account (was 30, now 29)
      case 29:
        return (
          <AccountScreen
            onContinue={() => {
              if (session?.user) {
                void syncNow(session.user.id);
              }
              goNext();
            }}
          />
        );

      // Paywall (was 31, now 30)
      case 30:
        return <Paywall onComplete={finish} />;

      default:
        return null;
    }
  };

  // Steps that manage their own footer (no sticky Continue button)
  const selfDriven =
    step === 24 ||
    step === 25 ||
    step === 26 ||
    step === 28 ||
    step === 29 ||
    step === 30;

  // Show top chrome (back arrow + progress bar) for steps 1–27
  const showTopBar = step > 0 && step < 28;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: OL.background }]}>
      {showTopBar ? (
        <View style={styles.topBar}>
          <View style={styles.backSlot}>
            <BackArrow onPress={goBack} />
          </View>
          <View style={styles.progressWrap}>
            <ProgressBar progress={progress} />
          </View>
        </View>
      ) : (
        <View style={styles.topSpacer} />
      )}

      <Animated.View style={[styles.content, { opacity: fade }]}>
        {renderStep()}
        {/* Step 23 always mounted so PhoneDemoVideo buffers before the user arrives */}
        <View
          style={step === 23 ? styles.step23Visible : styles.step23Hidden}
          pointerEvents={step === 23 ? "auto" : "none"}
        >
          <InsightScreen
            title="Recite and memorize, every morning"
            body="To turn off your alarm, recite your verse. Bible Wake makes scripture stick."
          >
            <PhoneDemoVideo style={{ height: Dimensions.get("window").height * 0.52 }} />
          </InsightScreen>
        </View>
      </Animated.View>

      {!selfDriven ? (
        <View style={styles.footer}>
          <ContinueButton disabled={!continueEnabled} onPress={goNext} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  step23Visible: {
    flex: 1,
  },
  step23Hidden: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backSlot: {
    width: 32,
    flexShrink: 0,
  },
  progressWrap: {
    flex: 1,
    minWidth: 0,
  },
  topSpacer: {
    height: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },

  /* Welcome */
  welcomeWrap: {
    flex: 1,
    justifyContent: "center",
    gap: 20,
  },
  welcomeTitle: {
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    color: OL.foreground,
    letterSpacing: -1,
    lineHeight: 40,
  },
  welcomeSub: {
    fontSize: 17,
    fontFamily: "Inter_400Regular",
    color: OL.mutedForeground,
    lineHeight: 26,
    maxWidth: 320,
  },

  /* Options (question steps) — centered vertically */
  optionsContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: 8,
  },

  /* Layouts */
  flexBody: {
    flex: 1,
  },
  centeredBody: {
    flex: 1,
  },
  centerFlex: {
    flex: 1,
    justifyContent: "center",
  },

  /* Typewriter step */
  typewriterBody: {
    flex: 1,
    justifyContent: "center",
  },

  /* Commitment */
  commitText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    marginBottom: 16,
  },
  dateStamp: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 12,
  },
});

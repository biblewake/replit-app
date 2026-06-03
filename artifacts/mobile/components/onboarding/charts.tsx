import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { OL, ONBOARDING_ORANGE } from "@/components/onboarding/primitives";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

const CHART_W = 300;
const CHART_H = 180;

function buildPath(values: number[], w: number, h: number, pad = 8): string {
  const n = values.length;
  if (n === 0) return "";
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  return values
    .map((v, i) => {
      const x = pad + (innerW * i) / (n - 1);
      const y = pad + innerH * (1 - v);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/* ──────────────────────────────────────────────────────────────────────────
 * AnimatedLineChart — two series drawing in after a 400ms delay.
 * Wrapped in a white card container.
 * ────────────────────────────────────────────────────────────────────────── */
export function AnimatedLineChart({
  rising,
  falling,
  risingLabel,
  fallingLabel,
  risingColor = "#FF3B30",
  fallingColor = ONBOARDING_ORANGE,
  showCrossMarkers,
}: {
  rising: number[];
  falling: number[];
  risingLabel: string;
  fallingLabel: string;
  risingColor?: string;
  fallingColor?: string;
  showCrossMarkers?: boolean;
}) {
  const reveal = useRef(new Animated.Value(0)).current;
  const [clipW, setClipW] = useState(0);

  useEffect(() => {
    reveal.setValue(0);
    const listener = reveal.addListener(({ value }) => setClipW(value * CHART_W));
    const timer = setTimeout(() => {
      Animated.timing(reveal, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, 400);
    return () => {
      clearTimeout(timer);
      reveal.removeListener(listener);
    };
  }, [reveal]);

  const risingPath = buildPath(rising, CHART_W, CHART_H);
  const fallingPath = buildPath(falling, CHART_W, CHART_H);

  return (
    <View style={chartStyles.card}>
      <View style={{ width: CHART_W, height: CHART_H }}>
        <Svg width={CHART_W} height={CHART_H} style={StyleSheet.absoluteFill}>
          {[0.25, 0.5, 0.75].map((g) => (
            <Line
              key={g}
              x1={8}
              x2={CHART_W - 8}
              y1={8 + (CHART_H - 16) * g}
              y2={8 + (CHART_H - 16) * g}
              stroke={OL.border}
              strokeWidth={1}
              strokeDasharray="4 6"
            />
          ))}
        </Svg>
        <View style={{ width: clipW, height: CHART_H, overflow: "hidden" }}>
          <Svg width={CHART_W} height={CHART_H}>
            <Path
              d={risingPath}
              stroke={risingColor}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d={fallingPath}
              stroke={fallingColor}
              strokeWidth={3.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {showCrossMarkers
              ? rising.map((v, i) => {
                  if (i % 3 !== 0) return null;
                  const x = 8 + ((CHART_W - 16) * i) / (rising.length - 1);
                  const y = 8 + (CHART_H - 16) * (1 - v);
                  return (
                    <SvgText key={i} x={x} y={y - 6} fontSize={12} fill={risingColor} textAnchor="middle">
                      ✕
                    </SvgText>
                  );
                })
              : null}
            <Circle
              cx={CHART_W - 8}
              cy={8 + (CHART_H - 16) * (1 - falling[falling.length - 1])}
              r={5}
              fill={fallingColor}
            />
          </Svg>
        </View>
      </View>
      <View style={chartStyles.legendRow}>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: fallingColor }]} />
          <Text style={[chartStyles.legendText, { color: OL.foreground }]}>{fallingLabel}</Text>
        </View>
        <View style={chartStyles.legendItem}>
          <View style={[chartStyles.legendDot, { backgroundColor: risingColor }]} />
          <Text style={[chartStyles.legendText, { color: OL.mutedForeground }]}>{risingLabel}</Text>
        </View>
      </View>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ComparisonCards — two side-by-side cards (Traditional vs Bible Wake).
 * ────────────────────────────────────────────────────────────────────────── */
export function ComparisonCards() {
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[chartStyles.compareRow, { opacity, transform: [{ scale }] }]}>
      <View style={[chartStyles.compareCard, { backgroundColor: OL.card, borderColor: OL.border }]}>
        <Text style={[chartStyles.compareHeading, { color: OL.mutedForeground }]}>Traditional</Text>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[chartStyles.alarmRow, { backgroundColor: OL.secondary }]}>
            <Text style={[chartStyles.alarmRowText, { color: OL.mutedForeground }]}>
              {`6:${(i * 5).toString().padStart(2, "0")} AM`}
            </Text>
          </View>
        ))}
        <View style={chartStyles.crossOverlay}>
          <Text style={chartStyles.crossMark}>✕</Text>
        </View>
      </View>
      <View style={[chartStyles.compareCard, { backgroundColor: OL.card, borderColor: ONBOARDING_ORANGE }]}>
        <Text style={[chartStyles.compareHeading, { color: ONBOARDING_ORANGE }]}>Bible Wake</Text>
        <View style={[chartStyles.alarmRow, { backgroundColor: `${ONBOARDING_ORANGE}1A` }]}>
          <Text style={[chartStyles.alarmRowText, { color: OL.foreground, fontFamily: "Inter_600SemiBold" }]}>
            6:00 AM
          </Text>
        </View>
        <View style={chartStyles.checkBadge}>
          <Text style={chartStyles.checkMark}>✓</Text>
        </View>
      </View>
    </Animated.View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * CountUpStat — animated counters with 300ms delay, haptics, onDone callback.
 * ────────────────────────────────────────────────────────────────────────── */
export function CountUpStat({
  values,
  onDone,
}: {
  values: { value: number; suffix?: string; label: string }[];
  onDone?: () => void;
}) {
  const doneCount = useRef(0);
  const total = values.length;

  const handleItemDone = () => {
    doneCount.current += 1;
    if (doneCount.current >= total) {
      onDone?.();
    }
  };

  return (
    <View style={chartStyles.countRow}>
      {values.map((v, i) => (
        <CountUpItem
          key={i}
          target={v.value}
          suffix={v.suffix}
          label={v.label}
          onDone={handleItemDone}
        />
      ))}
    </View>
  );
}

function CountUpItem({
  target,
  suffix = "%",
  label,
  onDone,
}: {
  target: number;
  suffix?: string;
  label: string;
  onDone?: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  const lastHapticRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const listener = anim.addListener(({ value }) => {
        const rounded = Math.round(value);
        setDisplay(rounded);
        if (rounded !== lastHapticRef.current && rounded % 5 === 0) {
          lastHapticRef.current = rounded;
          if (Platform.OS !== "web") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        }
      });
      Animated.timing(anim, {
        toValue: target,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        anim.removeListener(listener);
        onDone?.();
      });
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [anim, target, onDone]);

  return (
    <View style={chartStyles.countItem}>
      <Text style={[chartStyles.countNumber, { color: ONBOARDING_ORANGE }]}>
        {display}
        {suffix}
      </Text>
      <Text style={[chartStyles.countLabel, { color: OL.mutedForeground }]}>{label}</Text>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Typewriter — step 18. Reveals colored segments with a mid-sentence pause.
 * "Bible Wake" / "Wake up" / "Scripture" are highlighted in orange.
 * ────────────────────────────────────────────────────────────────────────── */
type Seg = { text: string; orange: boolean };

const TW_SEGMENTS: Seg[] = [
  { text: "Bible Wake", orange: true },
  { text: " combines both.", orange: false },
  // 450ms pause injected here
  { text: " Wake up", orange: true },
  { text: " on time & Start with ", orange: false },
  { text: "Scripture", orange: true },
  { text: ".", orange: false },
];

const TW_CHARS = TW_SEGMENTS.flatMap((s) =>
  s.text.split("").map((c) => ({ c, orange: s.orange }))
);

const TW_PAUSE_AT =
  TW_SEGMENTS[0].text.length + TW_SEGMENTS[1].text.length; // after "Bible Wake combines both."

export function Typewriter(_props: { text?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    let idx = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      idx += 1;
      setCount(idx);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      if (idx >= TW_CHARS.length) return;
      const delay = idx === TW_PAUSE_AT ? 450 : 42;
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 150);
    return () => clearTimeout(timer);
  }, []);

  // Group consecutive same-color chars into spans
  const visible = TW_CHARS.slice(0, count);
  const groups: { text: string; orange: boolean }[] = [];
  for (const { c, orange } of visible) {
    const last = groups[groups.length - 1];
    if (last && last.orange === orange) {
      last.text += c;
    } else {
      groups.push({ text: c, orange });
    }
  }

  return (
    <Text style={chartStyles.typewriter}>
      {groups.map((g, i) => (
        <Text
          key={i}
          style={{ color: g.orange ? ONBOARDING_ORANGE : OL.foreground }}
        >
          {g.text}
        </Text>
      ))}
    </Text>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * RecitalDemo — loops through 3 recital states.
 * ────────────────────────────────────────────────────────────────────────── */
export function RecitalDemo() {
  const [phase, setPhase] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    const cycle = () => {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      if (mounted) setPhase((p) => (p + 1) % 3);
    };
    const timer = setInterval(cycle, 1600);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [fade]);

  return (
    <View style={[chartStyles.demoCard, { backgroundColor: OL.card, borderColor: OL.border }]}>
      <Animated.View style={{ opacity: fade, alignItems: "center", gap: 12 }}>
        {phase === 0 ? (
          <>
            <Text style={[chartStyles.demoRef, { color: ONBOARDING_ORANGE }]}>Philippians 4:13</Text>
            <Text style={[chartStyles.demoVerse, { color: OL.foreground }]}>
              I can do all this through him who gives me strength.
            </Text>
          </>
        ) : phase === 1 ? (
          <>
            <Text style={[chartStyles.demoRef, { color: ONBOARDING_ORANGE }]}>Now recite it</Text>
            <Text style={[chartStyles.demoVerse, { color: OL.mutedForeground }]}>
              I can do all ▢▢▢▢ through ▢▢▢ who gives me ▢▢▢▢▢▢▢▢.
            </Text>
          </>
        ) : (
          <>
            <Text style={chartStyles.demoCheck}>✅</Text>
            <Text style={[chartStyles.demoVerse, { color: "#34C759", fontFamily: "Inter_600SemiBold" }]}>
              Verse memorized — alarm dismissed!
            </Text>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    width: "100%",
  },
  legendRow: {
    flexDirection: "row",
    gap: 20,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  compareRow: {
    flexDirection: "row",
    gap: 14,
    width: "100%",
    justifyContent: "center",
  },
  compareCard: {
    flex: 1,
    maxWidth: 160,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    gap: 8,
    minHeight: 200,
  },
  compareHeading: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  alarmRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  alarmRowText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  crossOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  crossMark: {
    fontSize: 56,
    color: "rgba(255,59,48,0.5)",
    fontFamily: "Inter_700Bold",
  },
  checkBadge: {
    alignSelf: "center",
    marginTop: 8,
  },
  checkMark: {
    fontSize: 40,
    color: "#34C759",
  },
  countRow: {
    flexDirection: "row",
    gap: 28,
    justifyContent: "center",
  },
  countItem: {
    alignItems: "center",
    gap: 6,
    maxWidth: 140,
  },
  countNumber: {
    fontSize: 52,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  countLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 18,
  },
  typewriter: {
    fontSize: 38,
    fontFamily: "Inter_700Bold",
    textAlign: "left",
    lineHeight: 48,
    letterSpacing: -0.5,
    width: "100%",
  },
  demoCard: {
    width: "100%",
    maxWidth: 320,
    minHeight: 180,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  demoRef: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  demoVerse: {
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    lineHeight: 26,
  },
  demoCheck: {
    fontSize: 48,
  },
});

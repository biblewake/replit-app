import React, { useRef, useState } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ONBOARDING_ORANGE } from "@/components/onboarding/primitives";

/**
 * SignatureCanvas — freehand signature pad backed by PanResponder + SVG paths.
 * Reports whether at least one stroke exists via onStrokeChange.
 *
 * Uses refs for both the path accumulator and the panResponder so that
 * parent re-renders (e.g. when canContinue flips) never cause a recreation
 * or unmount of the drawing surface.
 */
export function SignatureCanvas({
  onStrokeChange,
}: {
  onStrokeChange: (hasStroke: boolean) => void;
}) {
  // Keep a stable ref to the latest callback so the panResponder (created once)
  // always calls the current version without being recreated.
  const onStrokeChangeRef = useRef(onStrokeChange);
  onStrokeChangeRef.current = onStrokeChange;

  // Committed strokes + current in-progress stroke, both in refs so drawing
  // doesn't cause React re-renders mid-stroke.
  const committedPaths = useRef<string[]>([]);
  const currentPath = useRef("");

  // Single counter-state just to trigger a repaint when paths change.
  const [, repaint] = useState(0);

  // Create panResponder ONCE and never recreate it.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        repaint((n) => n + 1);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        repaint((n) => n + 1);
      },
      onPanResponderRelease: () => {
        if (currentPath.current) {
          committedPaths.current = [...committedPaths.current, currentPath.current];
          currentPath.current = "";
          onStrokeChangeRef.current(committedPaths.current.length > 0);
          repaint((n) => n + 1);
        }
      },
    })
  ).current;

  const clear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    committedPaths.current = [];
    currentPath.current = "";
    onStrokeChangeRef.current(false);
    repaint((n) => n + 1);
  };

  const allPaths = currentPath.current
    ? [...committedPaths.current, currentPath.current]
    : committedPaths.current;

  const hasStrokes = allPaths.length > 0;

  return (
    <View style={styles.wrap}>
      {!hasStrokes ? (
        <Text style={styles.placeholder}>Sign to make it official</Text>
      ) : null}
      <View style={styles.canvas} {...panResponder.panHandlers}>
        <Svg style={StyleSheet.absoluteFill}>
          {allPaths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke="#1C1C1E"
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {hasStrokes ? (
          <Pressable onPress={clear} style={styles.clearBtn} hitSlop={10}>
            <Ionicons name="close" size={18} color="#666666" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    gap: 8,
  },
  placeholder: {
    textAlign: "center",
    fontSize: 14,
    color: "#8E8E93",
    fontFamily: "Inter_400Regular",
  },
  canvas: {
    width: "100%",
    height: 200,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    overflow: "hidden",
  },
  clearBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
});

export { ONBOARDING_ORANGE };

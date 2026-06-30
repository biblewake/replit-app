import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";
import { useIsNativeTabs } from "@/hooks/useIsNativeTabs";
import { Alarm, useAlarms } from "@/context/AlarmContext";
import AlarmCard from "@/components/AlarmCard";
import AlarmEditSheet from "@/components/AlarmEditSheet";

const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 49;

export default function AlarmsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isNativeTabs = useIsNativeTabs();
  const router = useRouter();
  const { alarms, addAlarm, updateAlarm, deleteAlarm, toggleAlarm, alarmKitConfigureError, clearAlarmKitConfigureError } = useAlarms();
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);
  const [showNewAlarm, setShowNewAlarm] = useState(false);
  const [newAlarmType, setNewAlarmType] = useState<"verse" | "normal">("verse");
  const [fabOpen, setFabOpen] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const pill1TranslateY = useRef(new Animated.Value(40)).current;
  const pill2TranslateY = useRef(new Animated.Value(40)).current;
  const pill1Opacity = useRef(new Animated.Value(0)).current;
  const pill2Opacity = useRef(new Animated.Value(0)).current;
  const fabRotate = useRef(new Animated.Value(0)).current;
  const currentAnim = useRef<Animated.CompositeAnimation | null>(null);

  const fabBottom = TAB_BAR_HEIGHT + 24 + insets.bottom;

  const openFab = () => {
    if (fabOpen) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    currentAnim.current?.stop();
    overlayOpacity.setValue(0);
    pill1TranslateY.setValue(40);
    pill2TranslateY.setValue(40);
    pill1Opacity.setValue(0);
    pill2Opacity.setValue(0);
    fabRotate.setValue(0);

    setFabOpen(true);

    currentAnim.current = Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fabRotate, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.back(1.8)),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(30),
        Animated.parallel([
          Animated.timing(pill2TranslateY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
          Animated.timing(pill2Opacity, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(80),
        Animated.parallel([
          Animated.timing(pill1TranslateY, {
            toValue: 0,
            duration: 280,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
          Animated.timing(pill1Opacity, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);
    currentAnim.current.start();
  };

  const closeFab = (cb?: () => void) => {
    currentAnim.current?.stop();

    currentAnim.current = Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(fabRotate, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pill1TranslateY, {
        toValue: 40,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pill1Opacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(pill2TranslateY, {
        toValue: 40,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pill2Opacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]);
    currentAnim.current.start(({ finished }) => {
      if (finished) {
        setFabOpen(false);
        cb?.();
      }
    });
  };

  const handlePickAlarmType = (type: "verse" | "normal") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeFab(() => {
      setNewAlarmType(type);
      setShowNewAlarm(true);
    });
  };

  const handleSaveNew = (alarm: Omit<Alarm, "id">) => {
    return addAlarm(alarm);
  };

  const handleSaveEdit = (alarm: Omit<Alarm, "id">) => {
    if (editingAlarm) {
      return updateAlarm(editingAlarm.id, alarm);
    }
  };

  const handleDelete = () => {
    if (editingAlarm) {
      deleteAlarm(editingAlarm.id);
      setEditingAlarm(null);
    }
  };

  const paddingTop = insets.top + (Platform.OS === "web" ? 67 : 16);

  const rotateInterpolate = fabRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "135deg"],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Alarms</Text>
      </View>

      {/* iOS AlarmKit configure-error banner — shown when scheduling returns
          "error" (App Group not set up) or "unavailable" (module missing).
          Alarms are saved but will not ring until the issue is resolved. */}
      {Platform.OS === "ios" && alarmKitConfigureError && (
        <Pressable
          onPress={clearAlarmKitConfigureError}
          style={styles.configureErrorBanner}
        >
          <Ionicons name="warning-outline" size={16} color="#FFFFFF" style={styles.configureErrorIcon} />
          <Text style={styles.configureErrorText}>
            Alarms may not ring. Tap to dismiss — contact support if this persists.
          </Text>
        </Pressable>
      )}

      <FlatList
        data={alarms}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: TAB_BAR_HEIGHT + 90 + insets.bottom },
        ]}
        scrollEnabled={!!alarms.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="alarm-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No Alarms
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Tap the + button to add your first alarm
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AlarmCard
            alarm={item}
            onToggle={() => {
              Haptics.selectionAsync();
              toggleAlarm(item.id);
            }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setEditingAlarm(item);
            }}
            onPermissionDenied={undefined}
          />
        )}
      />

      {/* FAB overlay system — all in one absolute container so z-order is explicit */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Layer 1: dark backdrop (visual only, no touch) */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.fabBackdrop, { opacity: overlayOpacity }]}
          pointerEvents="none"
        />

        {/* Layer 2: backdrop touch target (below pills + FAB) */}
        {fabOpen && (
          <Pressable
            style={[StyleSheet.absoluteFill, styles.fabBackdropPress]}
            onPress={() => closeFab()}
          />
        )}

        {/* Layer 3: pills (above backdrop press) */}
        <View
          style={[styles.pillsContainer, { bottom: fabBottom + 70 }]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.pillWrapper,
              { opacity: pill1Opacity, transform: [{ translateY: pill1TranslateY }] },
            ]}
            pointerEvents={fabOpen ? "auto" : "none"}
          >
            <Pressable
              style={styles.pill}
              onPress={() => handlePickAlarmType("verse")}
            >
              <View style={[styles.pillIconCircle, { backgroundColor: "#FF6B0015" }]}>
                <Ionicons name="book" size={18} color="#FF6B00" />
              </View>
              <Text style={styles.pillText}>Verse Alarm</Text>
            </Pressable>
          </Animated.View>

          <Animated.View
            style={[
              styles.pillWrapper,
              { opacity: pill2Opacity, transform: [{ translateY: pill2TranslateY }] },
            ]}
            pointerEvents={fabOpen ? "auto" : "none"}
          >
            <Pressable
              style={styles.pill}
              onPress={() => handlePickAlarmType("normal")}
            >
              <View style={[styles.pillIconCircle, { backgroundColor: "#007AFF15" }]}>
                <Ionicons name="alarm" size={18} color="#007AFF" />
              </View>
              <Text style={styles.pillText}>Normal Alarm</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Layer 4: FAB (always on top) */}
        <Pressable
          style={[
            styles.fab,
            {
              backgroundColor: colors.foreground,
              bottom: fabBottom,
            },
          ]}
          onPress={fabOpen ? () => closeFab() : openFab}
        >
          <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
            <Ionicons name="add" size={28} color={colors.primaryForeground} />
          </Animated.View>
        </Pressable>
      </View>

      <AlarmEditSheet
        visible={showNewAlarm}
        onClose={() => setShowNewAlarm(false)}
        onSave={handleSaveNew}
        alarmType={newAlarmType}
      />

      <AlarmEditSheet
        visible={!!editingAlarm}
        onClose={() => setEditingAlarm(null)}
        alarm={editingAlarm}
        onSave={handleSaveEdit}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 4,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 220,
  },
  fabBackdrop: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  fabBackdropPress: {
    // fills the whole screen; sits below pills + FAB in JSX order
  },
  pillsContainer: {
    position: "absolute",
    right: 16,
    gap: 10,
    alignItems: "flex-end",
  },
  pillWrapper: {
    alignItems: "flex-end",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 100,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  pillIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#1C1C1E",
  },
  fab: {
    position: "absolute",
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
  },
  configureErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D97706",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  configureErrorIcon: {
    flexShrink: 0,
  },
  configureErrorText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
});

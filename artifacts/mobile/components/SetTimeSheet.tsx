import React, { useEffect, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import BottomSheet from "@/components/BottomSheet";

const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const AMPM = ["AM", "PM"];

interface WheelColumnProps {
  items: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  formatItem?: (item: string | number) => string;
}

function WheelColumn({ items, selectedIndex, onSelect, formatItem }: WheelColumnProps) {
  const colors = useColors();
  const scrollRef = useRef<ScrollView>(null);
  const isScrolling = useRef(false);
  const isSettling = useRef(false);

  useEffect(() => {
    if (!isScrolling.current) {
      scrollRef.current?.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const snapToIndex = (offsetY: number) => {
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    if (clamped !== selectedIndex) {
      Haptics.selectionAsync();
      onSelect(clamped);
    }
    isSettling.current = true;
    scrollRef.current?.scrollTo({ y: clamped * ITEM_HEIGHT, animated: true });
    setTimeout(() => { isSettling.current = false; }, 200);
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSettling.current) return;
    isScrolling.current = false;
    snapToIndex(e.nativeEvent.contentOffset.y);
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isSettling.current) return;
    // Only snap here for slow drags that don't generate a momentum event.
    const velocityY = e.nativeEvent.velocity?.y ?? 0;
    if (Math.abs(velocityY) < 0.1) {
      isScrolling.current = false;
      snapToIndex(e.nativeEvent.contentOffset.y);
    }
  };

  return (
    <View style={styles.wheelColumn}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingVertical: ITEM_HEIGHT * 2,
        }}
        onScrollBeginDrag={() => { isScrolling.current = true; }}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
      >
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          const label = formatItem ? formatItem(item) : String(item);
          return (
            <Pressable
              key={i}
              style={styles.wheelItem}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(i);
                scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
              }}
            >
              <Text
                style={[
                  styles.wheelText,
                  {
                    color: isSelected ? colors.foreground : colors.mutedForeground,
                    fontFamily: isSelected ? "Inter_700Bold" : "Inter_400Regular",
                    opacity: isSelected ? 1 : 0.45,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

interface SetTimeSheetProps {
  visible: boolean;
  onClose: () => void;
  hour: number;
  minute: number;
  isPM: boolean;
  onDone: (hour: number, minute: number, isPM: boolean) => void;
}

export default function SetTimeSheet({
  visible,
  onClose,
  hour,
  minute,
  isPM,
  onDone,
}: SetTimeSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [localHour, setLocalHour] = useState(hour);
  const [localMinute, setLocalMinute] = useState(minute);
  const [localIsPM, setLocalIsPM] = useState(isPM);

  useEffect(() => {
    if (visible) {
      setLocalHour(hour);
      setLocalMinute(minute);
      setLocalIsPM(isPM);
    }
  }, [visible, hour, minute, isPM]);

  const hourIndex = HOURS.indexOf(localHour === 0 ? 12 : localHour);
  const minuteIndex = localMinute;
  const ampmIndex = localIsPM ? 1 : 0;

  const handleDone = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onDone(localHour, localMinute, localIsPM);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height={440}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Set Time</Text>
      </View>

      <View style={[styles.pickerContainer, { backgroundColor: colors.secondary, borderRadius: 20, marginHorizontal: 20 }]}>
        <View
          style={[
            styles.selectionHighlight,
            { backgroundColor: colors.card },
          ]}
          pointerEvents="none"
        />
        <View style={styles.pickerRow}>
          <WheelColumn
            items={HOURS}
            selectedIndex={hourIndex < 0 ? 0 : hourIndex}
            onSelect={(i) => setLocalHour(HOURS[i])}
            formatItem={(h) => String(h)}
          />
          <View style={styles.colonContainer} pointerEvents="none">
            <Text style={[styles.colon, { color: colors.foreground }]}>:</Text>
          </View>
          <WheelColumn
            items={MINUTES}
            selectedIndex={minuteIndex}
            onSelect={(i) => setLocalMinute(MINUTES[i])}
            formatItem={(m) => String(m).padStart(2, "0")}
          />
          <View style={styles.ampmSpacer} />
          <WheelColumn
            items={AMPM}
            selectedIndex={ampmIndex}
            onSelect={(i) => setLocalIsPM(i === 1)}
          />
        </View>
      </View>

      <Pressable
        style={[styles.doneBtn, { marginBottom: Math.max(insets.bottom, 16) + 8 }]}
        onPress={handleDone}
      >
        <Text style={styles.doneBtnText}>Done</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingBottom: 16,
    paddingTop: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  pickerContainer: {
    height: PICKER_HEIGHT,
    overflow: "hidden",
    position: "relative",
  },
  selectionHighlight: {
    position: "absolute",
    left: 16,
    right: 16,
    top: ITEM_HEIGHT * 2,
    height: ITEM_HEIGHT,
    borderRadius: 12,
    zIndex: 0,
  },
  pickerRow: {
    flexDirection: "row",
    height: PICKER_HEIGHT,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  wheelColumn: {
    flex: 1,
    height: PICKER_HEIGHT,
    overflow: "hidden",
  },
  wheelItem: {
    height: ITEM_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wheelText: {
    fontSize: 26,
  },
  colonContainer: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  colon: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  ampmSpacer: {
    width: 12,
  },
  doneBtn: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
});

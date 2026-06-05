import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number | "auto";
  backgroundColor?: string;
  showCloseButton?: boolean;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;
const USE_NATIVE_DRIVER = Platform.OS !== "web";

export default function BottomSheet({
  visible,
  onClose,
  children,
  height = SCREEN_HEIGHT * 0.65,
  backgroundColor,
  showCloseButton = true,
}: BottomSheetProps) {
  const colors = useColors();
  const sheetBg = backgroundColor ?? colors.card;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      animRef.current?.stop();
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      setModalVisible(true);
    } else {
      animRef.current?.stop();
      animRef.current = Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 260,
          easing: Easing.linear,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]);
      animRef.current.start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }
  }, [visible]);

  useEffect(() => {
    if (!modalVisible) return;
    animRef.current = Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.poly(4)),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]);
    animRef.current.start();
  }, [modalVisible]);

  const sheetHeight =
    typeof height === "number" ? height : SCREEN_HEIGHT * 0.85;

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              backgroundColor: sheetBg,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.topRow}>
            <View style={styles.grabber} />
            {showCloseButton && (
              <Pressable onPress={onClose} hitSlop={8} style={styles.glassCloseWrap}>
                <BlurView intensity={65} tint="light" style={styles.glassClose}>
                  <Ionicons name="close" size={20} color="rgba(0,0,0,0.55)" />
                </BlurView>
              </Pressable>
            )}
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    elevation: 24,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
    position: "relative",
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D1D6",
  },
  glassCloseWrap: {
    position: "absolute",
    right: 16,
  },
  glassClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
  },
});

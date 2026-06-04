import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

interface CameraBackgroundProps {
  children: React.ReactNode;
  overlayOpacity?: number;
}

export default function CameraBackground({
  children,
  overlayOpacity = 0.45,
}: CameraBackgroundProps) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (Platform.OS !== "web" && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  if (Platform.OS === "web" || !permission?.granted) {
    return (
      <View style={styles.fallback}>
        <View style={[styles.overlay, { opacity: overlayOpacity }]} />
        {children}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="front"
        mirror
      />
      <View style={[styles.overlay, { opacity: overlayOpacity }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    backgroundColor: "#0D0D0D",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
  },
});

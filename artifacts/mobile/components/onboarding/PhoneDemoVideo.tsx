import React, { useRef } from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Video, ResizeMode } from "expo-av";

interface PhoneDemoVideoProps {
  style?: StyleProp<ViewStyle>;
}

export function PhoneDemoVideo({ style }: PhoneDemoVideoProps) {
  const videoRef = useRef<Video>(null);

  return (
    <Video
      ref={videoRef}
      source={require("../../assets/videos/bible-wake-phone.mp4")}
      style={[styles.video, style]}
      resizeMode={ResizeMode.CONTAIN}
      shouldPlay
      isLooping
      isMuted
      useNativeControls={false}
    />
  );
}

const styles = StyleSheet.create({
  video: {
    width: "100%",
    aspectRatio: 9 / 19,
  },
});

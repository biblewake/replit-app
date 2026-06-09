import { Platform } from "react-native";

/**
 * Returns true when running under NativeTabs (Liquid Glass) on iOS 26+.
 * When true, NativeTabs already handles the top safe-area inset natively —
 * screens must NOT add insets.top manually or content will be double-padded.
 */
export function useIsNativeTabs(): boolean {
  return Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 26;
}

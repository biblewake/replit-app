import { useTheme } from "@/context/ThemeContext";

import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 *
 * Reads from ThemeContext so the user's in-app dark-mode toggle is respected.
 * Falls back to the light palette when no dark key is defined.
 */
export function useColors() {
  const { colorScheme } = useTheme();
  const palette = colorScheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}

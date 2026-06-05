import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current color scheme.
 * The app is always light-mode.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}

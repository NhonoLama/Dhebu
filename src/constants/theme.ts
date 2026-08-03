export type ColorScheme = {
  primary: string;
  primaryDark: string;
  background: string;
  surface: string;
  income: string;
  expense: string;
  muted: string;
  ink: string;
  border: string;
  white: string;
};

export const lightColors: ColorScheme = {
  primary: "#1E96FC",
  primaryDark: "#0B6FCE",
  background: "#F7F9FC",
  surface: "#FFFFFF",
  income: "#16C784",
  expense: "#F0453D",
  muted: "#6B7280",
  ink: "#0F172A",
  border: "#E5E9F0",
  white: "#FFFFFF",
};

export const darkColors: ColorScheme = {
  primary: "#3EA6FF",
  primaryDark: "#63B4FF",
  background: "#0B0F14",
  surface: "#161C24",
  income: "#22D992",
  expense: "#FF6B62",
  muted: "#94A3B8",
  ink: "#F1F5F9",
  border: "#232B36",
  white: "#FFFFFF",
};

// Legacy static import — still used by RootLayout's pre-theme splash state.
// Screens should migrate to useTheme() instead of importing this directly.
export const Colors = lightColors;

export const Fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semiBold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
};

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
};

export const Radii = {
  small: 8,
  medium: 14,
  large: 20,
  pill: 999,
};

export const BottomTabInset = 24;
export const MaxContentWidth = 560;

/** Soft, colored drop shadow used on cards and the floating tab bar. */
export function createShadows(colors: ColorScheme) {
  return {
    soft: {
      shadowColor: colors.primary,
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6, // Android uses `elevation` instead of shadow* props
    },
  };
}

// Legacy static export (light mode shadow) — same migration note as Colors.
export const Shadows = createShadows(lightColors);
